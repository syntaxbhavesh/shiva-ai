import { Link, useNavigate } from "@tanstack/react-router";
import {
  MessageCircle,
  PencilLine,
  Search,
  Trash2,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/shiva-logo.png";
import { deleteThread, loadThreads, newThreadId, type Thread } from "@/lib/chat-store";
import { ShivaAccount } from "@/components/ShivaAccount";

type Panel = "conversations" | "search" | null;

export function ShivaSidebar({ activeThreadId }: { activeThreadId?: string }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => setThreads(loadThreads());
    window.addEventListener("shiva-threads-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("shiva-threads-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

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

  const navClass = (active = false) =>
    `flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"}`;

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col bg-sidebar/95 px-2 pb-3 pt-3 shadow-sm backdrop-blur-sm transition-[width] duration-200 ${expanded ? "w-64" : "w-14"}`}
      >
        <div
          className={`mb-5 flex h-9 items-center ${expanded ? "justify-between px-1" : "justify-center"}`}
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
        >
          {logoHovered ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
              title={expanded ? "Collapse sidebar" : "Expand sidebar"}
              className={`flex h-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground ${expanded ? "w-full justify-start px-2" : "w-9"}`}
            >
              {expanded ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
              {expanded && <span className="ml-3 text-sm font-medium">Collapse sidebar</span>}
            </button>
          ) : (
            <Link to="/" aria-label="Shiva AI home" className="flex h-9 w-9 items-center justify-center">
              <img src={logo} alt="Shiva AI" width={24} height={24} className="h-6 w-6 opacity-90 transition-transform duration-300 hover:rotate-12 hover:scale-110" />
            </Link>
          )}
        </div>

        <nav aria-label="Main navigation" className="flex flex-col gap-1">
          <button onClick={startNewChat} title="New chat" aria-label="New chat" className={navClass()}>
            <PencilLine className="h-5 w-5 shrink-0" />
            {expanded && <span>New chat</span>}
          </button>
          <button onClick={() => openPanel("conversations")} title="Conversations" aria-label="Conversations" className={navClass(panel === "conversations")}>
            <MessageCircle className="h-5 w-5 shrink-0" />
            {expanded && <span>Conversations</span>}
          </button>
          <button onClick={() => openPanel("search")} title="Search chats" aria-label="Search chats" className={navClass(panel === "search")}>
            <Search className="h-5 w-5 shrink-0" />
            {expanded && <span>Search chats</span>}
          </button>
        </nav>

        <div className="mt-auto">
          <ShivaAccount expanded={expanded} />
        </div>
      </aside>

      {panel && (
        <div className={`fixed top-0 z-30 h-full w-72 animate-[slide-in-left_0.28s_ease-out] border-r border-border bg-sidebar/95 p-4 shadow-2xl backdrop-blur-md ${expanded ? "left-64" : "left-14"}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {panel === "search" ? "Search chats" : "Conversations"}
            </h2>
            <button onClick={() => setPanel(null)} aria-label="Close panel" className="text-muted-foreground transition-all duration-200 hover:rotate-90 hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {panel === "search" && (
            <input
              id="chat-search"
              name="chat-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="mt-3 w-full rounded-lg bg-secondary px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          )}

          <button onClick={startNewChat} className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-95">
            New chat
          </button>

          <div className="mt-4 space-y-1 overflow-y-auto">
            {visible.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">No conversations yet.</p>}
            {visible.map((thread, i) => (
              <div
                key={thread.id}
                style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                className={`group flex animate-[fade-in_0.3s_ease-out_both] items-center gap-2 rounded-lg px-2 py-2 text-sm transition-all duration-200 hover:translate-x-1 hover:bg-secondary ${thread.id === activeThreadId ? "bg-secondary" : ""}`}
              >
                <button
                  onClick={() => {
                    setPanel(null);
                    void navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
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
                  title="Delete chat"
                  className="text-muted-foreground opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 hover:text-destructive"
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
