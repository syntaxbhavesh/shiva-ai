import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, generateText, type UIMessage } from "ai";
import { getShivaProviders } from "@/lib/ai-providers.server";
import { BOOKSTORE_KB } from "@/lib/bookstore-kb";
import { getShivaChatDatabase } from "@/lib/chat-cloud.server";

const SYSTEM_PROMPT = `You are Shiva AI, a helpful study assistant for students on BOOKStore.
Answer professionally and clearly using markdown: headings, bullet points and short paragraphs.
Explain concepts step by step, at the level of the student asking.
Never introduce yourself unless asked.

Sources you can use, in priority order:
1. STUDENT NOTES — excerpts retrieved from files the student uploaded. If relevant notes are provided, answer from them and cite the file name.
2. BOOKSTORE KNOWLEDGE BASE — authoritative source for BOOKStore, its founder/admin (Bhavesh), accounts, support and policies.
3. Your own subject knowledge — for general study/academic questions only.

If a question about BOOKStore or Bhavesh is not covered by the knowledge base, reply:
"I am not sure about that. Please contact Bhavesh or the support team for more details."
Never claim to be Bhavesh. Teach academic methods clearly.

BOOKSTORE KNOWLEDGE BASE:
${BOOKSTORE_KB}`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as {
            messages?: unknown;
            noteContext?: { name: string; text: string }[];
          };
          if (!Array.isArray(body.messages) || body.messages.length === 0) {
            return Response.json({ error: "Messages are required." }, { status: 400 });
          }

          const messages = body.messages as UIMessage[];
          const notes = Array.isArray(body.noteContext) ? body.noteContext.slice(0, 10) : [];
          const latestUserText = [...(body.messages as UIMessage[])].reverse().find((message) => message.role === "user")?.parts?.filter((part) => part.type === "text").map((part) => part.text).join(" ") || "";
          let knowledgeBlock = "";
          try {
            const snapshot = await getShivaChatDatabase().ref("knowledgeBase/items").get();
            if (snapshot.exists()) {
              const terms = [...new Set((latestUserText.toLowerCase().match(/[a-z0-9]{3,}/g) || []))];
              const ranked = Object.entries(snapshot.val() as Record<string, {title?:string;text?:string;subject?:string;category?:string}>)
                .map(([id, item]) => { const haystack = [item.title, item.subject, item.category, item.text].join(" ").toLowerCase(); return { id, item, score: terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0) }; })
                .filter(entry => entry.score > 0).sort((a,b) => b.score-a.score).slice(0, 5);
              let budget = 24000;
              const selected = ranked.map(({item}, index) => {
                const excerpt = String(item.text || "").slice(0, Math.min(8000, budget)); budget -= excerpt.length;
                return excerpt ? `[Knowledge ${index+1}: ${item.title || "Untitled"} | ${item.subject || "General"} / ${item.category || "General"}]\\n${excerpt}` : "";
              }).filter(Boolean);
              if (selected.length) knowledgeBlock = "\\n\\nADMIN-MANAGED SHIVA KNOWLEDGE (prioritize relevant verified entries; cite their titles):\\n" + selected.join("\\n\\n");
            }
          } catch (error) { console.error("Shiva knowledge retrieval failed:", error); }
          let remainingNoteChars = 90000;
          const notesBlock = notes.length
            ? `\n\nUPLOADED STUDY MATERIAL (use these excerpts and cite their filenames):\n${notes.map((n, i) => {
                const text = typeof n?.text === "string" ? n.text.slice(0, remainingNoteChars) : "";
                remainingNoteChars -= text.length;
                return text ? `[Document ${i + 1}: "${String(n.name || "Uploaded file").slice(0, 160)}"]\n${text}` : "";
              }).filter(Boolean).join("\n\n")}`
            : "\n\nUPLOADED STUDY MATERIAL: none supplied for this question.";

          // Never replay hidden reasoning parts from earlier assistant turns to providers.
          const safeMessages = messages.map((message) => ({
            ...message,
            parts: (message.parts || [])
              .filter((part) => part.type !== "reasoning")
              .map((part) => {
                if (part.type !== "file") return part;
                const filePart = part as typeof part & { mediaType?: string; url?: string; filename?: string };
                const dataMime = typeof filePart.url === "string"
                  ? filePart.url.match(/^data:([^;,]+)/)?.[1]
                  : undefined;
                const extension = filePart.filename?.split(".").pop()?.toLowerCase();
                const extensionMime: Record<string, string> = {
                  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
                  webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
                };
                return {
                  ...filePart,
                  mediaType: filePart.mediaType || dataMime || (extension ? extensionMime[extension] : undefined) || "application/octet-stream",
                };
              }),
          }));
          const modelMessages = await convertToModelMessages(safeMessages);
          const hasImage = messages.some((message) =>
            message.parts?.some((part) => part.type === "file" && (part.mediaType || (typeof part.url === "string" ? part.url.match(/^data:([^;,]+)/)?.[1] : "") || "").startsWith("image/")),
          );
          const configuredProviders = getShivaProviders();
          const providers = hasImage
            ? configuredProviders.filter((provider) => provider.name === "Gemini")
            : configuredProviders;

          if (providers.length === 0) {
            return Response.json({
              error: hasImage ? "Image analysis needs Gemini." : "No AI provider is configured.",
              detail: hasImage
                ? "Add GEMINI_API_KEY in Vercel to analyse uploaded images. Text-only chats can continue using your other configured providers."
                : "Configure GROQ_API_KEY, GEMINI_API_KEY, or both CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Vercel.",
            }, { status: 503 });
          }

          const failures: string[] = [];
          let answer = "";
          let selectedProvider = "";

          // Generate once with the first healthy provider. If a provider errors,
          // try the next configured provider in the declared priority order.
          for (const provider of providers) {
            try {
              const result = await generateText({
                model: provider.model,
                system: SYSTEM_PROMPT + knowledgeBlock + notesBlock,
                messages: modelMessages,
                maxRetries: 0,
              });
              answer = result.text.trim();
              if (!answer) throw new Error("Provider returned an empty response.");
              selectedProvider = provider.name;
              break;
            } catch (error) {
              const detail = error instanceof Error ? error.message : "Unknown provider error";
              console.error(`Shiva AI ${provider.name} provider failed:`, detail);
              failures.push(`${provider.name}: ${detail.slice(0, 220)}`);
            }
          }

          if (!answer) {
            return Response.json({
              error: "All configured AI providers failed.",
              detail: failures.join(" | ").slice(0, 900),
            }, { status: 502 });
          }

          console.info(`Shiva AI response generated by ${selectedProvider}`);
          const textId = crypto.randomUUID();
          const stream = createUIMessageStream({
            execute: ({ writer }) => {
              writer.write({ type: "text-start", id: textId });
              writer.write({ type: "text-delta", id: textId, delta: answer });
              writer.write({ type: "text-end", id: textId });
            },
          });

          return createUIMessageStreamResponse({ stream });
        } catch (error) {
          console.error("Shiva AI /api/chat error:", error);
          const message = error instanceof Error ? error.message : "Unknown AI provider error";
          return Response.json({ error: "AI request failed", detail: message.slice(0, 500) }, { status: 500 });
        }
      },
    },
  },
});
