import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  type UIMessage,
} from "ai";
import { createGroqProvider, createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { BOOKSTORE_KB } from "@/lib/bookstore-kb";

const SYSTEM_PROMPT = `You are Shiva AI, a helpful study assistant for students on BOOKStore.
Answer professionally and clearly using markdown: headings, bullet points and short paragraphs.
Explain concepts step by step, at the level of the student asking.
Never introduce yourself unless asked.

Sources you can use, in priority order:
1. STUDENT NOTES — excerpts retrieved from files (PDFs/notes) the student uploaded. If any notes are provided, read them first and answer from them whenever they contain anything related to the question. Cite the file name. If no excerpt is relevant, say so briefly and answer from your own knowledge.
2. BOOKSTORE KNOWLEDGE BASE — authoritative source for BOOKStore, its founder/admin (Bhavesh), accounts, support and policies. Always use it for such questions instead of guessing.
3. Your own subject knowledge — for general study/academic questions only.

If a question about BOOKStore or Bhavesh is not covered by the knowledge base, reply:
"I am not sure about that. Please contact Bhavesh or the support team for more details."
Never claim to be Bhavesh. Teach academic methods clearly.

BOOKSTORE KNOWLEDGE BASE:
${BOOKSTORE_KB}`;

type NoteExcerpt = { name: string; text: string };

function errorResponse(error: string, status: number, detail?: string) {
  return Response.json({ error, ...(detail ? { detail } : {}) }, { status });
}

function isNoteExcerpt(value: unknown): value is NoteExcerpt {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  return typeof note.name === "string" && typeof note.text === "string";
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body: unknown = await request.json();
          if (!body || typeof body !== "object") {
            return errorResponse("Invalid chat request.", 400);
          }

          const payload = body as { messages?: unknown; noteContext?: unknown };
          if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
            return errorResponse("Send a message before starting the chat.", 400);
          }

          const messages = payload.messages as UIMessage[];
          const safeMessages = messages.map((message) => ({
            ...message,
            parts: (Array.isArray(message.parts) ? message.parts : []).filter(
              (part) => part.type !== "reasoning",
            ),
          }));
          const modelMessages = await convertToModelMessages(safeMessages);

          const notes = Array.isArray(payload.noteContext)
            ? payload.noteContext.filter(isNoteExcerpt).slice(0, 6)
            : [];
          const notesBlock = notes.length
            ? `\n\nSTUDENT NOTES (retrieved excerpts):\n${notes
                .map((note, index) => `[${index + 1}] From "${note.name}":\n${note.text.slice(0, 12000)}`)
                .join("\n\n")}`
            : "\n\nSTUDENT NOTES: none relevant for this question.";

          const groqKey = process.env["GROQ_API_KEY"]?.trim();
          const lovableKey = process.env["LOVABLE_API_KEY"]?.trim();
          const providers: { name: string; model: ReturnType<ReturnType<typeof createGroqProvider>> }[] = [];

          if (groqKey && groqKey !== "Enter-Your-API") {
            providers.push({
              name: "Groq",
              model: createGroqProvider(groqKey)("llama-3.3-70b-versatile"),
            });
          }
          if (lovableKey) {
            providers.push({
              name: "Lovable",
              model: createLovableAiGatewayProvider(lovableKey)("google/gemini-3.6-flash"),
            });
          }

          if (providers.length === 0) {
            return errorResponse(
              "No AI provider is configured. Add GROQ_API_KEY or LOVABLE_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy.",
              503,
            );
          }

          let answer = "";
          const failures: string[] = [];
          for (const provider of providers) {
            try {
              const result = await generateText({
                model: provider.model,
                system: SYSTEM_PROMPT + notesBlock,
                messages: modelMessages,
                maxRetries: 0,
              });
              answer = result.text.trim();
              if (!answer) throw new Error("Provider returned an empty response.");
              break;
            } catch (providerError) {
              const detail =
                providerError instanceof Error ? providerError.message : "Unknown provider error";
              console.error(`Shiva AI ${provider.name} provider failed:`, detail);
              failures.push(`${provider.name}: ${detail.slice(0, 220)}`);
            }
          }

          if (!answer) {
            return errorResponse(
              "Shiva AI could not get a response from its configured AI provider.",
              502,
              failures.join(" | ").slice(0, 900),
            );
          }

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
          const detail = error instanceof Error ? error.message : "Unknown chat request error";
          console.error("Shiva AI /api/chat request failed:", detail);
          return errorResponse("Shiva AI could not process this chat request.", 500);
        }
      },
    },
  },
});
