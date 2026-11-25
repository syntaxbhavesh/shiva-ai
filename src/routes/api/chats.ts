import { createFileRoute } from "@tanstack/react-router";
import { getShivaChatDatabase, verifyBookstoreIdToken } from "@/lib/chat-cloud.server";

async function getUid(request: Request) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Error("UNAUTHORIZED");
  return (await verifyBookstoreIdToken(token)).uid;
}
export const Route = createFileRoute("/api/chats")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        const uid = await getUid(request);
        const snapshot = await getShivaChatDatabase().ref(`users/${uid}/chats`).get();
        const chats = snapshot.exists() ? Object.values(snapshot.val() as Record<string, unknown>) : [];
        return Response.json({ chats }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
        console.error("Shiva chats GET failed:", error);
        return Response.json({ error: unauthorized ? "Sign in required." : "Could not load chats." }, { status: unauthorized ? 401 : 503 });
      }
    },
    PUT: async ({ request }) => {
      try {
        const uid = await getUid(request);
        const body = await request.json() as { id?: string; title?: string; messages?: unknown[]; createdAt?: number; updatedAt?: number };
        if (!body.id || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.id) || !Array.isArray(body.messages) || body.messages.length > 200) return Response.json({ error: "Invalid chat data." }, { status: 400 });
        if (JSON.stringify(body.messages).length > 900000) return Response.json({ error: "Chat is too large." }, { status: 413 });
        const db = getShivaChatDatabase();
        const chatRef = db.ref(`users/${uid}/chats/${body.id}`);
        const existing = await chatRef.get();
        const old = existing.exists() ? existing.val() as { createdAt?: number } : {};
        await chatRef.set({
          id: body.id,
          title: typeof body.title === "string" ? body.title.slice(0, 100) : "New chat",
          messages: body.messages,
          createdAt: old.createdAt || Number(body.createdAt) || Date.now(),
          updatedAt: Number(body.updatedAt) || Date.now(),
        });
        return Response.json({ ok: true });
      } catch (error) {
        const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
        console.error("Shiva chats PUT failed:", error);
        return Response.json({ error: unauthorized ? "Sign in required." : "Could not save chat." }, { status: unauthorized ? 401 : 503 });
      }
    },
    DELETE: async ({ request }) => {
      try {
        const uid = await getUid(request);
        const id = new URL(request.url).searchParams.get("id") || "";
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Response.json({ error: "Invalid chat ID." }, { status: 400 });
        await getShivaChatDatabase().ref(`users/${uid}/chats/${id}`).remove();
        return Response.json({ ok: true });
      } catch (error) {
        const unauthorized = error instanceof Error && error.message === "UNAUTHORIZED";
        console.error("Shiva chats DELETE failed:", error);
        return Response.json({ error: unauthorized ? "Sign in required." : "Could not delete chat." }, { status: unauthorized ? 401 : 503 });
      }
    },
  }},
});
