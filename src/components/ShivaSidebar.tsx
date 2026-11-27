import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, PanelLeft, PencilLine, Search, Trash2, X, Pin } from "lucide-react";
import { useEffect, useState } from "react";
import logo from "@/assets/shiva-logo.png";
import { deleteThread, loadThreads, newThreadId, type Thread } from "@/lib/chat-store";
import { ShivaAccount } from "@/components/ShivaAccount";
import { onAuthStateChanged } from "firebase/auth";
import { bookstoreAuth } from "@/lib/bookstore-firebase";
import { syncCloudThreads } from "@/lib/chat-store";

type Panel = "conversations" | "search" | null;

export function ShivaSidebar({ activeThreadId }: { activeThreadId?: string }) {
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const [expanded, setExpanded] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [query, setQuery] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);

  useEffect(() => {
    const closePanels = () => setPanel(null);
    window.addEventListener("shiva-close-chat-panels", closePanels);
    const refresh = () => setThreads(loadThreads());
    window.addEventListener("shiva-threads-updated", refresh);
    window.addEventListener("storage", refresh);
    const unsubscribeAuth = onAuthStateChanged(bookstoreAuth, async (user) => {
      if (!user) {
        setThreads(loadThreads());
        return;
      }
      setLoadingThreads(true);
      setThreadLoadError(null);
      try {
        await syncCloudThreads();
        setThreads(loadThreads(user.uid));
      } catch (error) {
        console.error("Could not load Shiva AI conversations:", error);
        setThreads(loadThreads(user.uid));
        setThreadLoadError("Couldn't sync cloud conversations. Showing saved chats on this device.");
      } finally {
        setLoadingThreads(false);
      }
    });
    return () => {
      unsubscribeAuth();
      window.removeEventListener("shiva-close-chat-panels", closePanels);
      window.removeEventListener("shiva-threads-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  async function openPanel(next: Panel) {
    setThreads(loadThreads());
    setPanel((current) => (current === next ? null : next));
    if (next === null) return;
    const user = bookstoreAuth.currentUser;
    if (!user) return;
    setLoadingThreads(true);
    setThreadLoadError(null);
    try {
      await syncCloudThreads();
      if (bookstoreAuth.currentUser?.uid === user.uid) setThreads(loadThreads(user.uid));
    } catch (error) {
      console.error("Could not refresh Shiva AI conversations:", error);
      setThreadLoadError("Couldn't sync cloud conversations. Showing saved chats on this device.");
    } finally {
      setLoadingThreads(false);
    }
  }

  function startNewChat() {
    setPanel(null);
    void navigate({ to: "/chat/$threadId", params: { threadId: newThreadId() } });
  }

  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? threads.filter((thread) => {
        const titleMatches = thread.title.toLowerCase().includes(normalizedQuery);
        const messageMatches = thread.messages.some((message) =>
          message.parts.some((part) =>
            part.type === "text" && part.text.toLowerCase().includes(normalizedQuery),
          ),
        );
        return titleMatches || messageMatches;
      })
    : threads;

  function getSearchExcerpt(thread: Thread) {
    if (!normalizedQuery) return "";
    const matchingText = thread.messages
      .flatMap((message) => message.parts.map((part) => part.type === "text" ? part.text : ""))
      .find((text) => text.toLowerCase().includes(normalizedQuery));
    if (!matchingText) return "";
    const index = matchingText.toLowerCase().indexOf(normalizedQuery);
    const start = Math.max(0, index - 42);
    const end = Math.min(matchingText.length, index + normalizedQuery.length + 68);
    return `${start > 0 ? "…" : ""}${matchingText.slice(start, end).replace(/\s+/g, " ")}${end < matchingText.length ? "…" : ""}`;
  }

  function getDateGroup(timestamp: number) {
    const date = new Date(timestamp || 0);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const daysAgo = Math.floor((today - day) / 86400000);
    if (daysAgo <= 0) return "Today";
    if (daysAgo === 1) return "Yesterday";
    if (daysAgo < 7) return "Previous 7 days";
    if (daysAgo < 30) return "Previous 30 days";
    return "Older";
  }

  const groupedThreads = visible.reduce<Record<string, Thread[]>>((groups, thread) => {
    const group = getDateGroup(thread.updatedAt);
    (groups[group] ??= []).push(thread);
    return groups;
  }, {});
  const groupOrder = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"];

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
        <div className={`fixed top-0 z-30 flex h-full w-80 flex-col animate-[slide-in-left_0.28s_ease-out] border-r border-border bg-sidebar/95 p-4 shadow-2xl backdrop-blur-md ${expanded ? "left-64" : "left-14"}`}>
          <div className="flex items-center justify-between">
            <div className="min-w-0"><h2 className="text-sm font-semibold">
              {panel === "search" ? "Search chats" : "Your conversations"}
            </h2><p className="mt-1 text-xs text-muted-foreground">Pick up where you left off</p></div>
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
              placeholder="Search titles and messages..."
              className="mt-3 w-full animate-[fade-in_0.25s_ease-out] rounded-xl border border-border/70 bg-background/70 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-muted-foreground"
            />
          )}

          <button
            onClick={startNewChat}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:brightness-110 active:scale-[.98]"
          >
            <PencilLine className="h-4 w-4" /> New chat
          </button>

          <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1">
            {loadingThreads && <p className="px-1 py-2 text-xs text-muted-foreground">Refreshing chats…</p>}
            {threadLoadError && <p role="status" className="rounded-lg bg-secondary/70 px-2.5 py-2 text-xs text-muted-foreground">{threadLoadError}</p>}
            {!loadingThreads && visible.length === 0 && (
              <div className="rounded-xl border border-dashed border-border/80 px-3 py-5 text-center">
                <Search className="mx-auto mb-2 h-5 w-5 text-muted-foreground/70" />
                <p className="text-sm font-medium">{normalizedQuery ? "No matching chats" : "No conversations yet"}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{normalizedQuery ? "Try a different word from the chat title or message." : "Start a new chat and it will appear here."}</p>
              </div>
            )}
            {groupOrder.map((group) => groupedThreads[group]?.length ? (
              <section key={group} aria-label={group}>
                <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/75">{group}</h3>
                <div className="space-y-0.5">
                  {groupedThreads[group].map((thread, i) => (
              <div
                key={thread.id}
                style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }}
                className={`group flex animate-[fade-in_0.3s_ease-out_both] items-start gap-2 rounded-xl px-2.5 py-2.5 text-sm transition-colors hover:bg-secondary/80 ${thread.id === activeThreadId ? "bg-secondary/90" : ""}`}
              >
                <button
                  onClick={() => {
                    setPanel(null);
                    void navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex min-w-0 items-center gap-1.5"><span className="block min-w-0 truncate font-medium">{thread.title || "New chat"}</span>{thread.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" aria-label="Pinned chat" />}</span>
                  {normalizedQuery && getSearchExcerpt(thread) && (
                    <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">{getSearchExcerpt(thread)}</span>
                  )}
                </button>
                <button
                  aria-label="Delete chat"
                  onClick={() => {
                    deleteThread(thread.id);
                    setThreads(loadThreads());
                    if (thread.id === activeThreadId) startNewChat();
                  }}
                  title="Delete chat"
                  className="shrink-0 rounded-md p-1 text-muted-foreground opacity-100 transition-colors hover:bg-background hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                  </div>
                ))}
                </div>
              </section>
            ) : null)}
          </div>
        </div>
      )}
    </>
  );
}
