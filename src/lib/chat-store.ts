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

export function loadThreads(): Thread[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Thread[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[], uid = bookstoreAuth.currentUser?.uid) {
  if (!hasWindow()) return;
  window.localStorage.setItem(storageKey(uid), JSON.stringify(threads));
  notifyThreadsChanged();
}

async function authorizedFetch(path: string, init?: RequestInit) {
  const user = bookstoreAuth.currentUser;
  if (!user) return null;
  const token = await user.getIdToken();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
}

export async function syncCloudThreads(): Promise<Thread[]> {
  if (!bookstoreAuth.currentUser) return [];
  const response = await authorizedFetch("/api/chats");
  if (!response?.ok) throw new Error("Could not sync your Shiva AI chats.");
  const payload = await response.json() as { chats?: Thread[] };
  const threads = Array.isArray(payload.chats) ? payload.chats.sort((a, b) => b.updatedAt - a.updatedAt) : [];
  saveThreads(threads, bookstoreAuth.currentUser?.uid);
  return threads;
}

export function newThreadId() {
  return hasWindow() && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function getThread(id: string): Thread | undefined {
  return loadThreads().find((thread) => thread.id === id);
}

export function ensureThread(id: string): Thread {
  const existing = getThread(id);
  if (existing) return existing;
  const thread: Thread = { id, title: "New chat", createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  saveThreads([thread, ...loadThreads()]);
  return thread;
}

function saveThreadToCloud(thread: Thread) {
  if (!bookstoreAuth.currentUser) return;
  void authorizedFetch("/api/chats", {
    method: "PUT",
    body: JSON.stringify(thread),
  }).then((response) => {
    if (response && !response.ok) console.error("Shiva AI chat cloud save failed:", response.status);
  }).catch((error) => console.error("Shiva AI chat cloud save failed:", error));
}

export function persistThread(id: string, messages: UIMessage[]) {
  const threads = loadThreads();
  const index = threads.findIndex((thread) => thread.id === id);
  const firstUser = messages.find((message) => message.role === "user");
  const titleText = firstUser?.parts.map((part) => (part.type === "text" ? part.text : "")).join("").trim() ?? "";
  const existing = index >= 0 ? threads[index] : undefined;
  const title = existing?.title && existing.title !== "New chat"
    ? existing.title
    : titleText ? titleText.slice(0, 40) : "New chat";
  const next: Thread = {
    id,
    title,
    createdAt: existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    messages,
  };
  if (index >= 0) threads[index] = next;
  else threads.unshift(next);
  saveThreads(threads);
  saveThreadToCloud(next);
}

export function setThreadTitle(id: string, title: string) {
  const cleanTitle = title.trim().slice(0, 64);
  if (!cleanTitle) return;
  const threads = loadThreads();
  const index = threads.findIndex((thread) => thread.id === id);
  if (index < 0) return;
  threads[index] = { ...threads[index], title: cleanTitle, updatedAt: Date.now() };
  saveThreads(threads);
  saveThreadToCloud(threads[index]);
}

export function deleteThread(id: string) {
  saveThreads(loadThreads().filter((thread) => thread.id !== id));
  if (bookstoreAuth.currentUser) {
    void authorizedFetch(`/api/chats?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      .then((response) => { if (response && !response.ok) console.error("Shiva AI cloud chat deletion failed:", response.status); })
      .catch((error) => console.error("Shiva AI cloud chat deletion failed:", error));
  }
}
