import { createFileRoute } from "@tanstack/react-router";
import { getShivaChatDatabase, verifyBookstoreIdToken } from "@/lib/chat-cloud.server";

async function authenticatedUid(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("UNAUTHORIZED");
  const decoded = await verifyBookstoreIdToken(token);
  return decoded.uid;
}

export const Route = createFileRoute("/api/chats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const uid = await authenticatedUid(request);
          const snapshot = await getShivaChatDatabase().ref(`users/${uid}/chats`).get();
          const chats = snapshot.exists() ? Object.values(snapshot.val() as Record<string, unknown>) : [];
          return Response.json({ chats }, { headers: { "Cache-Control": "no-store" } });
        } catch (error) {
          const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
          console.error("Shiva chat load failed:", error instanceof Error ? error.message : error);
          return Response.json({ error: unauthorized ? "Sign in required." : "Could not load chats." }, { status: unauthorized ? 401 : 503 });
        }
      },
      PUT: async ({ request }) => {
        try {
          const uid = await authenticatedUid(request);
          const body = await request.json() as { id?: string; title?: string; messages?: unknown[]; createdAt?: number; updatedAt?: number };
          if (!body.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.id) || !Array.isArray(body.messages) || body.messages.length > 200) {
            return Response.json({ error: "Invalid chat data." }, { status: 400 });
          }
          const serialized = JSON.stringify(body.messages);
          if (serialized.length > 900_000) return Response.json({ error: "This chat is too large to save." }, { status: 413 });
          const db = getShivaChatDatabase();
          const chatRef = db.ref(`users/${uid}/chats/${body.id}`);
          const existing = await chatRef.get();
          const data = {
            id: body.id,
            title: typeof body.title === "string" ? body.title.slice(0, 100) : "New chat",
            messages: body.messages,
            createdAt: Number(body.createdAt) || Date.now(),
            updatedAt: Number(body.updatedAt) || Date.now(),
          };
          if (existing.exists()) {
            const old = existing.val() as { createdAt?: number };
            data.createdAt = old.createdAt || data.createdAt;
          }
          await chatRef.set(data);
          return Response.json({ ok: true });
        } catch (error) {
          const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
          console.error("Shiva chat save failed:", error instanceof Error ? error.message : error);
          return Response.json({ error: unauthorized ? "Sign in required." : "Could not save chat." }, { status: unauthorized ? 401 : 503 });
        }
      },
      DELETE: async ({ request }) => {
        try {
          const uid = await authenticatedUid(request);
          const url = new URL(request.url);
          const id = url.searchParams.get("id") || "";
          if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Response.json({ error: "Invalid chat ID." }, { status: 400 });
          await getShivaChatDatabase().ref(`users/${uid}/chats/${id}`).remove();
          return Response.json({ ok: true });
        } catch (error) {
          const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
          console.error("Shiva chat delete failed:", error instanceof Error ? error.message : error);
          return Response.json({ error: unauthorized ? "Sign in required." : "Could not delete chat." }, { status: unauthorized ? 401 : 503 });
        }
      },
    },
  },
});
