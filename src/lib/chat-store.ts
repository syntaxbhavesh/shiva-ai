import type { UIMessage } from "ai";
import { bookstoreAuth } from "@/lib/bookstore-firebase";

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  createdAt?: number;
  messages: UIMessage[];
};

function storageKey(uid = bookstoreAuth.currentUser?.uid) {
  return uid ? `shiva-ai-threads:${uid}` : "shiva-ai-threads:guest";
}
function hasWindow() {
  return typeof window !== "undefined";
}
function notifyThreadsChanged() {
  if (hasWindow()) window.dispatchEvent(new Event("shiva-threads-updated"));
}
function cache(threads: Thread[], uid = bookstoreAuth.currentUser?.uid) {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(storageKey(uid), JSON.stringify(threads));
    notifyThreadsChanged();
  } catch (error) {
    console.error("Shiva AI could not save local chat history:", error);
  }
}
function readThreads(uid = bookstoreAuth.currentUser?.uid): Thread[] {
  if (!hasWindow()) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(uid)) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((thread): thread is Thread =>
      !!thread && typeof thread === "object" &&
      typeof (thread as Thread).id === "string" &&
      Array.isArray((thread as Thread).messages),
    ).sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
  } catch {
    return [];
  }
}
export function loadThreads(uid = bookstoreAuth.currentUser?.uid): Thread[] {
  return readThreads(uid);
}
export function saveThreads(threads: Thread[], uid = bookstoreAuth.currentUser?.uid) {
  cache(threads, uid);
}
export function newThreadId() {
  return hasWindow() && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}
export function getThread(id: string) {
  return loadThreads().find((thread) => thread.id === id);
}
export function ensureThread(id: string): Thread {
  const found = getThread(id);
  if (found) return found;
  const now = Date.now();
  const thread: Thread = { id, title: "New chat", createdAt: now, updatedAt: now, messages: [] };
  cache([thread, ...loadThreads()]);
  return thread;
}
export function persistThread(id: string, messages: UIMessage[]) {
  const threads = loadThreads();
  const index = threads.findIndex((thread) => thread.id === id);
  const firstUser = messages.find((message) => message.role === "user");
  const titleText = firstUser?.parts.map((part) => part.type === "text" ? part.text : "").join("").trim() ?? "";
  const old = index >= 0 ? threads[index] : undefined;
  const next: Thread = {
    id,
    title: old?.title && old.title !== "New chat" ? old.title : titleText ? titleText.slice(0, 40) : "New chat",
    createdAt: old?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    messages,
  };
  if (index >= 0) threads[index] = next;
  else threads.unshift(next);
  cache(threads);
}
export function setThreadTitle(id: string, title: string) {
  const clean = title.trim().slice(0, 64);
  if (!clean) return;
  const threads = loadThreads();
  const index = threads.findIndex((thread) => thread.id === id);
  if (index < 0) return;
  threads[index] = { ...threads[index], title: clean, updatedAt: Date.now() };
  cache(threads);
}
export function deleteThread(id: string) {
  cache(loadThreads().filter((thread) => thread.id !== id));
}

// Backward-compatible local-only loader for components from the previous cloud-sync UI.
// This intentionally performs no network or cloud database requests.
export async function syncCloudThreads(): Promise<Thread[]> {
  return loadThreads();
}
