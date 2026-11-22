import type { UIMessage } from "ai";

export type Thread = {
  id: string;
  title: string;
  updatedAt: number;
  messages: UIMessage[];
};

const KEY = "shiva-ai-threads";

function hasWindow() {
  return typeof window !== "undefined";
}

export function loadThreads(): Thread[] {
  if (!hasWindow()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Thread[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.updatedAt - a.updatedAt)
      : [];
  } catch {
    return [];
  }
}

export function saveThreads(threads: Thread[]) {
  if (!hasWindow()) return;
  window.localStorage.setItem(KEY, JSON.stringify(threads));
  window.dispatchEvent(new Event("shiva-threads-updated"));
}

export function newThreadId() {
  return hasWindow() && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function getThread(id: string): Thread | undefined {
  return loadThreads().find((t) => t.id === id);
}

export function ensureThread(id: string): Thread {
  const existing = getThread(id);
  if (existing) return existing;
  const thread: Thread = { id, title: "New chat", updatedAt: Date.now(), messages: [] };
  saveThreads([thread, ...loadThreads()]);
  return thread;
}

export function persistThread(id: string, messages: UIMessage[]) {
  const threads = loadThreads();
  const index = threads.findIndex((t) => t.id === id);
  const firstUser = messages.find((m) => m.role === "user");
  const titleText =
    firstUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join("").trim() ?? "";
  const existingTitle = index >= 0 ? threads[index].title : "";
  const title = existingTitle && existingTitle !== "New chat"
    ? existingTitle
    : titleText ? titleText.slice(0, 40) : "New chat";
  const next: Thread = { id, title, updatedAt: Date.now(), messages };
  if (index >= 0) threads[index] = next;
  else threads.unshift(next);
  saveThreads(threads);
}

export function setThreadTitle(id: string, title: string) {
  const cleanTitle = title.trim().slice(0, 64);
  if (!cleanTitle) return;
  const threads = loadThreads();
  const index = threads.findIndex((thread) => thread.id === id);
  if (index < 0) return;
  threads[index] = { ...threads[index], title: cleanTitle, updatedAt: Date.now() };
  saveThreads(threads);
}

export function deleteThread(id: string) {
  saveThreads(loadThreads().filter((t) => t.id !== id));
}
