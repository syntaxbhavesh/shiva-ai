import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { BOOKSTORE_KB } from "@/lib/bookstore-kb";

const SYSTEM_PROMPT = `You are Shiva AI, a helpful study assistant for students on BOOKStore.
Answer professionally and clearly using markdown: headings, bullet points and short paragraphs.
Explain concepts step by step, at the level of the student asking.
Never introduce yourself unless asked.

Sources you can use, in priority order:
1. STUDENT NOTES — excerpts retrieved from files the student uploaded. When they are provided and relevant, answer from them and cite the file name.
2. BOOKSTORE KNOWLEDGE BASE — the authoritative source for anything about the platform, its founder/admin (Bhavesh), EduPie, accounts, payments, support and policies. Always use it for such questions instead of guessing.
3. Your own subject knowledge — for general study/academic questions only.

If a question about BOOKStore, Bhavesh or EduPie is not covered by the knowledge base, reply:
"I am not sure about that. Please contact Bhavesh or the support team for more details."
Never claim to be Bhavesh. Do not solve homework or exam questions outright — teach the method and point to resources.

BOOKSTORE KNOWLEDGE BASE:
${BOOKSTORE_KB}`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as {
          messages?: unknown;
          noteContext?: { name: string; text: string }[];
        };
        const messages = body.messages;
        if (!Array.isArray(messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const notes = Array.isArray(body.noteContext) ? body.noteContext.slice(0, 6) : [];
        const notesBlock = notes.length
          ? `\n\nSTUDENT NOTES (retrieved excerpts for the latest question):\n${notes
              .map((n, i) => `[${i + 1}] From "${n.name}":\n${n.text}`)
              .join("\n\n")}`
          : "\n\nSTUDENT NOTES: none relevant for this question.";

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: SYSTEM_PROMPT + notesBlock,
          messages: await convertToModelMessages(messages as UIMessage[]),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages as UIMessage[],
        });
      },
    },
  },
});
