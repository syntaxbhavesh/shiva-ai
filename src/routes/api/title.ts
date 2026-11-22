import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { getShivaProviders } from "@/lib/ai-providers.server";

export const Route = createFileRoute("/api/title")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { messages?: { role?: string; text?: string }[] };
          const conversation = Array.isArray(body.messages)
            ? body.messages.slice(-16).map((m) => `${m.role === "assistant" ? "Assistant" : "User"}: ${String(m.text || "").slice(0, 1200)}`).join("\n")
            : "";
          if (!conversation.trim()) return Response.json({ title: "New chat" }, { status: 400 });

          const providers = getShivaProviders();
          for (const provider of providers) {
            try {
              const result = await generateText({
                model: provider.model,
                system: "Create a concise, specific title for this entire conversation, like ChatGPT conversation titles. Identify the main topic and intent, not just the first user message. Return only 3-7 words, no quotes, no punctuation at the end.",
                prompt: conversation,
                maxRetries: 0,
              });
              const title = result.text.replace(/^["'\s]+|["'\s]+$/g, "").replace(/[.!?]+$/, "").slice(0, 64);
              if (title) return Response.json({ title });
            } catch (error) {
              console.error(`Shiva AI title generation via ${provider.name} failed:`, error);
            }
          }
          return Response.json({ error: "Could not generate a conversation title." }, { status: 502 });
        } catch (error) {
          console.error("Shiva AI /api/title error:", error);
          return Response.json({ error: "Title generation failed." }, { status: 500 });
        }
      },
    },
  },
});
