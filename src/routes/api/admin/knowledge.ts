import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { verifyBookstoreIdToken, getShivaChatDatabase } from "@/lib/chat-cloud.server";

const ADMIN_UID = "F9UxJ3W6CVUVIIgwByuHQxscQab2";
async function authorize(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("UNAUTHORIZED");
  const user = await verifyBookstoreIdToken(token);
  if (user.uid !== ADMIN_UID) throw new Error("FORBIDDEN");
  return user;
}
function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Request failed";
  return Response.json({ error: message }, { status: message === "UNAUTHORIZED" ? 401 : message === "FORBIDDEN" ? 403 : 500 });
}
export const Route = createFileRoute("/api/admin/knowledge")({
  server: { handlers: {
    GET: async ({ request }) => {
      try {
        await authorize(request);
        const snap = await getShivaChatDatabase().ref("knowledgeBase/items").get();
        const items = snap.exists() ? Object.entries(snap.val()).map(([id, value]) => ({ id, ...(value as object) })) : [];
        return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) { return errorResponse(error); }
    },
    POST: async ({ request }) => {
      try {
        await authorize(request);
        const body = await request.json() as Record<string, unknown>;
        const title = String(body.title || "").trim().slice(0, 180);
        const text = String(body.text || "").trim();
        const category = String(body.category || "General").trim().slice(0, 80);
        const subject = String(body.subject || "General").trim().slice(0, 80);
        if (!title || !text) return Response.json({ error: "Title and content are required." }, { status: 400 });
        if (text.length > 500000) return Response.json({ error: "Content is too large (500,000 character limit)." }, { status: 413 });
        const id = randomUUID();
        const now = Date.now();
        await getShivaChatDatabase().ref("knowledgeBase/items/" + id).set({ title, text, category, subject, source: String(body.source || "Manual entry").slice(0, 180), createdAt: now, updatedAt: now });
        return Response.json({ id });
      } catch (error) { return errorResponse(error); }
    },
    PUT: async ({ request }) => {
      try {
        await authorize(request);
        const body = await request.json() as Record<string, unknown>;
        const id = String(body.id || "");
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Response.json({ error: "Invalid item ID." }, { status: 400 });
        const ref = getShivaChatDatabase().ref("knowledgeBase/items/" + id);
        const snap = await ref.get();
        if (!snap.exists()) return Response.json({ error: "Knowledge item not found." }, { status: 404 });
        const old = snap.val();
        const title = String(body.title || "").trim().slice(0, 180);
        const text = String(body.text || "").trim();
        if (!title || !text) return Response.json({ error: "Title and content are required." }, { status: 400 });
        if (text.length > 500000) return Response.json({ error: "Content is too large." }, { status: 413 });
        await ref.update({ title, text, category: String(body.category || "General").slice(0, 80), subject: String(body.subject || "General").slice(0, 80), source: String(body.source || old.source || "Manual entry").slice(0, 180), updatedAt: Date.now() });
        return Response.json({ ok: true });
      } catch (error) { return errorResponse(error); }
    },
    DELETE: async ({ request }) => {
      try {
        await authorize(request);
        const id = new URL(request.url).searchParams.get("id") || "";
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return Response.json({ error: "Invalid item ID." }, { status: 400 });
        await getShivaChatDatabase().ref("knowledgeBase/items/" + id).remove();
        return Response.json({ ok: true });
      } catch (error) { return errorResponse(error); }
    },
  } },
});
