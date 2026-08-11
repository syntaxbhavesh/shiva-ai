import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createGroqProvider, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { BOOKSTORE_KB } from "@/lib/bookstore-kb";

const SYSTEM_PROMPT = `You are Shiva AI, a helpful study assistant for students on BOOKStore.
Answer professionally and clearly using markdown: headings, bullet points and short paragraphs.
Explain concepts step by step, at the level of the student asking.
Never introduce yourself unless asked.

Sources you can use, in priority order:
1. STUDENT NOTES — excerpts retrieved from files (PDFs/notes) the student uploaded. If any notes are provided, you MUST read them first and answer from them whenever they contain anything related to the question, quoting or paraphrasing the relevant lines and citing the file name. Do not ignore them and do not say you cannot access uploaded files — the excerpts below ARE the uploaded file content. Only if the excerpts truly contain nothing related, say so briefly and then answer from your own knowledge.
2. BOOKSTORE KNOWLEDGE BASE — the authoritative source for anything about the platform, its founder/admin (Bhavesh), accounts, support and policies. Always use it for such questions instead of guessing
3. Your own subject knowledge — for general study/academic questions only.

If a question about BOOKStore or Bhavesh is not covered by the knowledge base, reply:
"I am not sure about that. Please contact Bhavesh or the support team for more details."
Never claim to be Bhavesh. Do not solve homework or exam questions outright — teach the method and point to resources.

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
          const messages = body.messages;
          if (!Array.isArray(messages)) {
            return new Response("Messages are required", { status: 400 });
          }

          const groqKey = process.env["GROQ_API_KEY"]?.trim();
          const lovableKey = process.env["LOVABLE_API_KEY"]?.trim();
          const useGroq = Boolean(groqKey && groqKey !== "Enter-Your-API");

          if (!useGroq && !lovableKey) {
            return new Response("AI provider is not configured. Set GROQ_API_KEY or LOVABLE_API_KEY.", { status: 500 });
          }

          const notes = Array.isArray(body.noteContext) ? body.noteContext.slice(0, 6) : [];
          const notesBlock = notes.length
            ? `\n\nSTUDENT NOTES (retrieved excerpts for the latest question):\n${notes
                .map((n, i) => `[${i + 1}] From "${n.name}":\n${n.text}`)
                .join("\n\n")}`
            : "\n\nSTUDENT NOTES: none relevant for this question.";

          const model = useGroq
            ? createGroqProvider(groqKey!)("llama-3.3-70b-versatile")
            : createLovableAiGatewayProvider(lovableKey!)("google/gemini-3.6-flash");

          const result = streamText({
            model,
            system: SYSTEM_PROMPT + notesBlock,
            messages: await convertToModelMessages(messages as UIMessage[]),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
          });
        } catch (error) {
          console.error("Shiva AI /api/chat error:", error);
          const message = error instanceof Error ? error.message : "Unknown AI provider error";
          return new Response(`AI request failed: ${message}`, { status: 500 });
        }
      },
    },
  },
});
