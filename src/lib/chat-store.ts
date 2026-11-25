import type { UIMessage } from "ai";
import { onAuthStateChanged, signInWithCustomToken, signOut } from "firebase/auth";
import { get, onValue, ref, remove, set } from "firebase/database";
import { bookstoreAuth } from "@/lib/bookstore-firebase";
import { shivaChatAuth, shivaChatDatabase } from "@/lib/shiva-firebase";

export type Thread = { id: string; title: string; updatedAt: number; createdAt?: number; messages: UIMessage[] };
const TOKEN_FUNCTION_URL = import.meta.env.VITE_SHIVA_TOKEN_FUNCTION_URL as string | undefined;
let tokenExchange: Promise<void> | null = null;

function storageKey(uid = bookstoreAuth.currentUser?.uid) { return uid ? `shiva-ai-threads:${uid}` : "shiva-ai-threads:guest"; }
function hasWindow() { return typeof window !== "undefined"; }
function notifyThreadsChanged() { if (hasWindow()) window.dispatchEvent(new Event("shiva-threads-updated")); }
function cache(threads: Thread[], uid = bookstoreAuth.currentUser?.uid) {
  if (!hasWindow()) return;
  window.localStorage.setItem(storageKey(uid), JSON.stringify(threads));
  notifyThreadsChanged();
}
export function loadThreads(): Thread[] {
  if (!hasWindow()) return [];
  try { const value = JSON.parse(window.localStorage.getItem(storageKey()) || "[]") as Thread[]; return Array.isArray(value) ? value.sort((a,b) => b.updatedAt-a.updatedAt) : []; }
  catch { return []; }
}
export function saveThreads(threads: Thread[], uid = bookstoreAuth.currentUser?.uid) { cache(threads, uid); }

export async function ensureShivaChatAuth(): Promise<void> {
  const bookstoreUser = bookstoreAuth.currentUser;
  if (!bookstoreUser) { if (shivaChatAuth.currentUser) await signOut(shivaChatAuth); return; }
  if (shivaChatAuth.currentUser?.uid === bookstoreUser.uid) return;
  if (!TOKEN_FUNCTION_URL) throw new Error("VITE_SHIVA_TOKEN_FUNCTION_URL is not configured.");
  if (!tokenExchange) {
    tokenExchange = (async () => {
      const response = await fetch(TOKEN_FUNCTION_URL, { method: "POST", headers: { Authorization: `Bearer ${await bookstoreUser.getIdToken()}` } });
      const payload = await response.json() as { customToken?: string; error?: string };
      if (!response.ok || !payload.customToken) throw new Error(payload.error || "Could not connect secure chat storage.");
      const credential = await signInWithCustomToken(shivaChatAuth, payload.customToken);
      if (credential.user.uid !== bookstoreUser.uid) { await signOut(shivaChatAuth); throw new Error("BOOKStore and Shiva AI UIDs do not match."); }
    })().finally(() => { tokenExchange = null; });
  }
  await tokenExchange;
}
export async function syncCloudThreads(): Promise<Thread[]> {
  const user = bookstoreAuth.currentUser;
  if (!user) return [];
  await ensureShivaChatAuth();
  const snapshot = await get(ref(shivaChatDatabase, `users/${user.uid}/chats`));
  const chats = snapshot.exists() ? snapshot.val() as Record<string, Thread> : {};
  const threads = Object.values(chats).sort((a,b) => b.updatedAt-a.updatedAt);
  cache(threads, user.uid);
  return threads;
}
export function subscribeToCloudThreads(callback: (threads: Thread[]) => void) {
  let stopDatabase: (() => void) | undefined;
  const stopAuth = onAuthStateChanged(bookstoreAuth, async (user) => {
    stopDatabase?.(); stopDatabase = undefined;
    if (!user) { if (shivaChatAuth.currentUser) await signOut(shivaChatAuth); callback([]); return; }
    try {
      await ensureShivaChatAuth();
      if (bookstoreAuth.currentUser?.uid !== user.uid) return;
      stopDatabase = onValue(ref(shivaChatDatabase, `users/${user.uid}/chats`), snapshot => {
        const chats = snapshot.exists() ? snapshot.val() as Record<string, Thread> : {};
        const threads = Object.values(chats).sort((a,b) => b.updatedAt-a.updatedAt);
        cache(threads, user.uid); callback(threads);
      }, error => console.error("Shiva chat subscription failed:", error));
    } catch (error) { console.error("Shiva chat auth setup failed:", error); }
  });
  return () => { stopDatabase?.(); stopAuth(); };
}
export function newThreadId() { return hasWindow() && window.crypto?.randomUUID ? window.crypto.randomUUID() : Math.random().toString(36).slice(2); }
export function getThread(id: string) { return loadThreads().find(thread => thread.id === id); }
export function ensureThread(id: string): Thread {
  const found = getThread(id); if (found) return found;
  const thread = { id, title: "New chat", createdAt: Date.now(), updatedAt: Date.now(), messages: [] } satisfies Thread;
  cache([thread, ...loadThreads()]); return thread;
}
async function saveThreadToCloud(thread: Thread) {
  const user = bookstoreAuth.currentUser; if (!user) return;
  try { await ensureShivaChatAuth(); await set(ref(shivaChatDatabase, `users/${user.uid}/chats/${thread.id}`), thread); }
  catch (error) { console.error("Shiva AI cloud save failed:", error); }
}
export function persistThread(id: string, messages: UIMessage[]) {
  const threads = loadThreads(); const index = threads.findIndex(thread => thread.id === id);
  const firstUser = messages.find(message => message.role === "user");
  const titleText = firstUser?.parts.map(part => part.type === "text" ? part.text : "").join("").trim() ?? "";
  const old = index >= 0 ? threads[index] : undefined;
  const next: Thread = { id, title: old?.title && old.title !== "New chat" ? old.title : titleText ? titleText.slice(0,40) : "New chat", createdAt: old?.createdAt ?? Date.now(), updatedAt: Date.now(), messages };
  if (index >= 0) threads[index] = next; else threads.unshift(next);
  cache(threads); void saveThreadToCloud(next);
}
export function setThreadTitle(id: string, title: string) {
  const clean = title.trim().slice(0,64); if (!clean) return;
  const threads = loadThreads(); const index = threads.findIndex(thread => thread.id === id); if (index < 0) return;
  threads[index] = { ...threads[index], title: clean, updatedAt: Date.now() }; cache(threads); void saveThreadToCloud(threads[index]);
}
export function deleteThread(id: string) {
  cache(loadThreads().filter(thread => thread.id !== id));
  const user = bookstoreAuth.currentUser; if (!user) return;
  void ensureShivaChatAuth().then(() => remove(ref(shivaChatDatabase, `users/${user.uid}/chats/${id}`))).catch(error => console.error("Shiva AI chat deletion failed:", error));
}
