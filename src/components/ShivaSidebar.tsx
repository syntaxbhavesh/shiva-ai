import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, PencilLine, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import logo from "@/assets/shiva-logo.png";
import { deleteThread, loadThreads, newThreadId, type Thread } from "@/lib/chat-store";

type Panel = "conversations" | "search" | null;

export function ShivaSidebar({ activeThreadId }: { activeThreadId?: string }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [query, setQuery] = useState("");

  function openPanel(next: Panel) {
    setThreads(loadThreads());
    setPanel((current) => (current === next ? null : next));
  }

  function startNewChat() {
    setPanel(null);
    void navigate({ to: "/chat/$threadId", params: { threadId: newThreadId() } });
  }

  const visible =
    panel === "search" && query.trim()
      ? threads.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase()))
      : threads;

  return (
    <>
      <aside className="fixed left-0 top-0 z-40 flex h-full w-14 flex-col items-center gap-6 bg-sidebar/60 pt-4">
        <Link to="/" aria-label="Shiva AI home">
          <img src={logo} alt="Shiva AI" width={22} height={22} className="h-6 w-6 opacity-90" />
        </Link>
        <button
          onClick={startNewChat}
          title="New chat"
          aria-label="New chat"
          className="text-muted-foreground transition-transform hover:scale-110 hover:text-foreground"
        >
          <PencilLine className="h-5 w-5" />
        </button>
        <button
          onClick={() => openPanel("conversations")}
          title="Conversations"
          aria-label="Conversations"
          className={`transition-transform hover:scale-110 hover:text-foreground ${
            panel === "conversations" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <MessageCircle className="h-5 w-5" />
        </button>
        <button
          onClick={() => openPanel("search")}
          title="Search chats"
          aria-label="Search chats"
          className={`transition-transform hover:scale-110 hover:text-foreground ${
            panel === "search" ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          <Search className="h-5 w-5" />
        </button>
      </aside>

      {panel && (
        <div className="fixed left-14 top-0 z-30 h-full w-72 border-r border-border bg-sidebar p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {panel === "search" ? "Search chats" : "Conversations"}
            </h2>
            <button
              onClick={() => setPanel(null)}
              aria-label="Close panel"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {panel === "search" && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="mt-3 w-full rounded-lg bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
          )}

          <button
            onClick={startNewChat}
            className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            New chat
          </button>

          <div className="mt-4 space-y-1 overflow-y-auto">
            {visible.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">No conversations yet.</p>
            )}
            {visible.map((thread) => (
              <div
                key={thread.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-secondary ${
                  thread.id === activeThreadId ? "bg-secondary" : ""
                }`}
              >
                <button
                  onClick={() => {
                    setPanel(null);
                    void navigate({
                      to: "/chat/$threadId",
                      params: { threadId: thread.id },
                    });
                  }}
                  className="flex-1 truncate text-left"
                >
                  {thread.title}
                </button>
                <button
                  aria-label="Delete chat"
                  onClick={() => {
                    deleteThread(thread.id);
                    setThreads(loadThreads());
                    if (thread.id === activeThreadId) startNewChat();
                  }}
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
