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
  window.localStorage.setItem(storageKey(uid), JSON.stringify(threads));
  notifyThreadsChanged();
}

function readThreads(uid = bookstoreAuth.currentUser?.uid): Thread[] {
  if (!hasWindow()) return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey(uid)) || "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((thread): thread is Thread =>
        !!thread &&
        typeof thread === "object" &&
        typeof (thread as Thread).id === "string" &&
        Array.isArray((thread as Thread).messages),
      )
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
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

async function requestCloud(method: "GET" | "PUT" | "DELETE", body?: unknown, id?: string) {
  const user = bookstoreAuth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  const response = await fetch(
    method === "GET"
      ? "/api/chats"
      : method === "DELETE"
        ? `/api/chats?id=${encodeURIComponent(id || "")}`
        : "/api/chats",
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || "Chat cloud request failed.");
  }
  return method === "GET" ? await response.json() as { chats: Thread[] } : null;
}

function normalizeCloudThreads(chats: unknown): Thread[] {
  if (!Array.isArray(chats)) return [];
  return chats.filter((value): value is Thread => {
    if (!value || typeof value !== "object") return false;
    const thread = value as Partial<Thread>;
    return typeof thread.id === "string" &&
      thread.id.length > 0 &&
      Array.isArray(thread.messages);
  }).map((thread) => ({
    id: thread.id,
    title: typeof thread.title === "string" && thread.title.trim() ? thread.title : "New chat",
    messages: thread.messages,
    createdAt: Number(thread.createdAt) || Number(thread.updatedAt) || Date.now(),
    updatedAt: Number(thread.updatedAt) || Number(thread.createdAt) || 0,
  }));
}

/**
 * Restore all conversations for the signed-in BOOKStore UID.
 * Merge instead of replacing the local cache so a delayed cloud write or a
 * temporary older server snapshot cannot make existing conversations vanish.
 */
export async function syncCloudThreads(): Promise<Thread[]> {
  const user = bookstoreAuth.currentUser;
  if (!user) return [];

  const uid = user.uid;
  const result = await requestCloud("GET");
  if (bookstoreAuth.currentUser?.uid !== uid) return readThreads(uid);

  const cloudThreads = normalizeCloudThreads(result?.chats);
  const localThreads = readThreads(uid);
  const merged = new Map<string, Thread>();

  for (const thread of localThreads) merged.set(thread.id, thread);
  for (const thread of cloudThreads) {
    const local = merged.get(thread.id);
    if (!local || thread.updatedAt >= local.updatedAt) {
      merged.set(thread.id, thread);
    }
  }

  const threads = [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  cache(threads, uid);

  // Repair cloud entries that were present locally but missing or newer locally.
  // Keep writes sequential per thread so an older snapshot cannot overtake a newer one.
  for (const thread of threads) {
    const cloud = cloudThreads.find((item) => item.id === thread.id);
    if (!cloud || thread.updatedAt > cloud.updatedAt) {
      void saveThreadToCloud(thread);
    }
  }

  return threads;
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
  const thread = {
    id,
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  } satisfies Thread;
  cache([thread, ...loadThreads()]);
  return thread;
}

const cloudSaveQueues = new Map<string, Promise<void>>();

async function saveThreadToCloud(thread: Thread) {
  if (!bookstoreAuth.currentUser) return;
  const previous = cloudSaveQueues.get(thread.id) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(async () => {
      if (!bookstoreAuth.currentUser) return;
      await requestCloud("PUT", thread);
    });
  cloudSaveQueues.set(thread.id, next);
  try {
    await next;
  } catch (error) {
    console.error("Shiva AI cloud save failed:", error);
  } finally {
    if (cloudSaveQueues.get(thread.id) === next) cloudSaveQueues.delete(thread.id);
  }
}

export function persistThread(id: string, messages: UIMessage[]) {
  const threads = loadThreads();
  const index = threads.findIndex((thread) => thread.id === id);
  const firstUser = messages.find((message) => message.role === "user");
  const titleText = firstUser?.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("")
    .trim() ?? "";
  const old = index >= 0 ? threads[index] : undefined;
  const next: Thread = {
    id,
    title: old?.title && old.title !== "New chat"
      ? old.title
      : titleText
        ? titleText.slice(0, 40)
        : "New chat",
    createdAt: old?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    messages,
  };
  if (index >= 0) threads[index] = next;
  else threads.unshift(next);
  cache(threads);
  void saveThreadToCloud(next);
}

export function setThreadTitle(id: string, title: string) {
  const clean = title.trim().slice(0, 64);
  if (!clean) return;
  const threads = loadThreads();
  const index = threads.findIndex((thread) => thread.id === id);
  if (index < 0) return;
  threads[index] = { ...threads[index], title: clean, updatedAt: Date.now() };
  cache(threads);
  void saveThreadToCloud(threads[index]);
}

export function deleteThread(id: string) {
  cache(loadThreads().filter((thread) => thread.id !== id));
  if (!bookstoreAuth.currentUser) return;
  void requestCloud("DELETE", undefined, id).catch((error) =>
    console.error("Shiva AI cloud chat deletion failed:", error),
  );
}
