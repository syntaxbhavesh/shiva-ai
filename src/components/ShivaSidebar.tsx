import { Link, useNavigate } from "@tanstack/react-router";
import { MessageCircle, PanelLeft, PencilLine, Search, Trash2, X, Plug, Youtube, ChevronDown, ExternalLink, CheckCircle2, PlusCircle } from "lucide-react";
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
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [youtubeDetailsOpen, setYoutubeDetailsOpen] = useState(false);
  const [youtubeDemoConnected, setYoutubeDemoConnected] = useState(false);
  const [logoHovered, setLogoHovered] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [query, setQuery] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);

  useEffect(() => {
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

          <button
            type="button"
            onClick={() => { setPluginsOpen((open) => !open); setYoutubeDetailsOpen(false); }}
            title="Plugins"
            aria-label="Plugins"
            aria-expanded={pluginsOpen}
            className={`${menuItem} ${expanded ? "" : "w-10 justify-center px-0"} ${pluginsOpen ? "bg-secondary text-foreground" : ""}`}
          >
            <Plug className="h-[18px] w-[18px] shrink-0" />
            {expanded && <><span>Plugins</span><span className="ml-auto text-muted-foreground"><ChevronDown className={`h-4 w-4 transition-transform ${pluginsOpen ? "rotate-180" : ""}`} /></span></>}
          </button>
          {pluginsOpen && expanded && (
            <div className="ml-2 mt-1 space-y-2 rounded-xl border border-border/70 bg-background/70 p-2 animate-[fade-in_.18s_ease-out]">
              <button
                type="button"
                onClick={() => setYoutubeDetailsOpen((open) => !open)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-secondary"
              >
                <Youtube className="h-4 w-4 text-[#ff0033]" />
                <span className="flex-1 font-medium">YouTube</span>
                <span className={`h-2 w-2 rounded-full ${youtubeDemoConnected ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${youtubeDetailsOpen ? "rotate-180" : ""}`} />
              </button>
              {youtubeDetailsOpen && (
                <div className="space-y-2 rounded-lg bg-secondary/60 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">Find educational videos and get recommendations directly in your Shiva AI chats.</p>
                  <button
                    type="button"
                    onClick={() => setYoutubeDemoConnected((connected) => !connected)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                  >
                    {youtubeDemoConnected ? <><CheckCircle2 className="h-3.5 w-3.5" /> Demo connected</> : <><ExternalLink className="h-3.5 w-3.5" /> Preview authorization</>}
                  </button>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">Preview only. Google OAuth will be enabled after Google Cloud credentials and secure token storage are configured.</p>
                </div>
              )}
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                <PlusCircle className="h-4 w-4" />
                More plugins coming soon
              </div>
              <p className="px-2 text-[10px] text-muted-foreground/70">GitHub · Canva · More</p>
            </div>
          )}
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
