import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, PanelLeft, PencilLine, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/shiva-logo.png";
import { deleteThread, loadThreads, newThreadId, type Thread } from "@/lib/chat-store";
import { ShivaAccount } from "@/components/ShivaAccount";

type Panel = "conversations" | "search" | null;

export function ShivaSidebar({ activeThreadId }: { activeThreadId?: string }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const [expanded, setExpanded] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
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

  const menuItem =
    "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/80 hover:text-foreground active:scale-[.98]";

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full flex-col border-r border-border/50 bg-sidebar/90 pt-3 shadow-xl shadow-black/5 backdrop-blur-xl transition-[width] duration-300 ease-out ${expanded ? "w-64" : "w-14"}`}
      >
        <div className={`flex h-10 items-center px-3 ${expanded ? "justify-between" : "justify-center"}`}>
          {expanded ? (
            <>
              <Link to="/" aria-label="Shiva AI home" className="flex min-w-0 items-center gap-2.5">
                <img src={logo} alt="Shiva AI" width={25} height={25} className="h-6 w-6 shrink-0" />
                <span className="truncate text-sm font-semibold tracking-tight text-foreground">Shiva AI</span>
              </Link>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Collapse menu"
                title="Collapse menu"
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <PanelLeft className="h-[18px] w-[18px]" />
              </button>
            </>
          ) : (
            <div
              className="group relative grid h-9 w-9 place-items-center rounded-xl transition-colors hover:bg-secondary"
              onMouseEnter={() => setLogoHovered(true)}
              onMouseLeave={() => setLogoHovered(false)}
            >
              <Link to="/" aria-label="Shiva AI home" className="grid place-items-center">
                <img
                  src={logo}
                  alt="Shiva AI"
                  width={24}
                  height={24}
                  className={`h-6 w-6 transition-all duration-200 ${logoHovered ? "scale-75 opacity-0" : "opacity-95"}`}
                />
              </Link>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label="Open navigation menu"
                title="Open menu"
                className={`absolute inset-0 grid place-items-center rounded-xl text-foreground transition-all duration-200 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${logoHovered ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"}`}
              >
                <PanelLeft className="h-[19px] w-[19px]" />
              </button>
            </div>
          )}
        </div>

        <nav className={`mt-5 flex flex-col gap-1 px-2 ${expanded ? "" : "items-center"}`} aria-label="Main navigation">
          <button onClick={startNewChat} title="New chat" aria-label="New chat" className={`${menuItem} ${expanded ? "" : "w-10 justify-center px-0"}`}>
            <PencilLine className="h-[18px] w-[18px] shrink-0" />
            {expanded && <span>New chat</span>}
          </button>
          <button
            onClick={() => openPanel("search")}
            title="Search chats"
            aria-label="Search chats"
            className={`${menuItem} ${expanded ? "" : "w-10 justify-center px-0"} ${panel === "search" ? "bg-secondary text-foreground" : ""}`}
          >
            <Search className="h-[18px] w-[18px] shrink-0" />
            {expanded && <span>Search chats</span>}
          </button>
          <button
            onClick={() => openPanel("conversations")}
            title="Library"
            aria-label="Library"
            className={`${menuItem} ${expanded ? "" : "w-10 justify-center px-0"} ${panel === "conversations" ? "bg-secondary text-foreground" : ""}`}
          >
            <MessageCircle className="h-[18px] w-[18px] shrink-0" />
            {expanded && <span>Library</span>}
          </button>
        </nav>

        {expanded && (
          <div className="mx-3 mt-6 border-t border-border/70 pt-4">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Your chats</p>
            <button
              type="button"
              onClick={() => openPanel("conversations")}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Recent conversations</span>
            </button>
          </div>
        )}

        <div className="mt-auto border-t border-border/70 px-2 py-3">
          <ShivaAccount expanded={expanded} />
        </div>
      </aside>

      {panel && (
        <div className={`fixed top-0 z-30 h-full w-72 animate-[slide-in-left_0.28s_ease-out] border-r border-border bg-sidebar/95 p-4 shadow-2xl backdrop-blur-md ${expanded ? "left-64" : "left-14"}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {panel === "search" ? "Search chats" : "Conversations"}
            </h2>
            <button
              onClick={() => setPanel(null)}
              aria-label="Close panel"
              className="rounded-lg p-1 text-muted-foreground transition-all duration-200 hover:rotate-90 hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {panel === "search" && (
            <input
              id="chat-search"
              name="chat-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations..."
              className="mt-3 w-full animate-[fade-in_0.25s_ease-out] rounded-lg bg-secondary px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary placeholder:text-muted-foreground"
            />
          )}

          <button
            onClick={startNewChat}
            className="mt-3 w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-transform duration-200 hover:scale-[1.02] active:scale-95"
          >
            New chat
          </button>

          <div className="mt-4 space-y-1 overflow-y-auto">
            {visible.length === 0 && (
              <p className="px-1 py-2 text-xs text-muted-foreground">No conversations yet.</p>
            )}
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
