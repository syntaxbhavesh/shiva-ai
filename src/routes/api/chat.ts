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

function textError(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

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
            return textError("Send a message before starting the chat.", 400);
          }

          const groqKey = process.env["GROQ_API_KEY"]?.trim();
          const lovableKey = process.env["LOVABLE_API_KEY"]?.trim();
          const useGroq = Boolean(groqKey && groqKey !== "Enter-Your-API");

          if (!useGroq && !lovableKey) {
            console.error("Shiva AI is not configured: GROQ_API_KEY and LOVABLE_API_KEY are missing.");
            return textError(
              "Shiva AI is not configured on the server. Add GROQ_API_KEY in Vercel → Project Settings → Environment Variables, then redeploy.",
              503,
            );
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
            messages: await convertToModelMessages(body.messages as UIMessage[]),
          });

          return result.toUIMessageStreamResponse({
            originalMessages: body.messages as UIMessage[],
          });
        } catch (error) {
          // Keep provider diagnostics in server logs; never expose secrets or raw
          // upstream responses to the browser.
          console.error("Shiva AI /api/chat provider error:", error);
          return textError(
            "Shiva AI could not get a response from its AI provider. Check that the API key is valid, the selected model is available, and the provider account has access.",
            502,
          );
        }
      },
    },
  },
});
