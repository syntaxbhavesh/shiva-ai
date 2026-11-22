import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FileText, Loader2, Plus, SendHorizontal, Sparkles, BookOpen, Lightbulb, Atom, X, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ShivaSidebar } from "@/components/ShivaSidebar";
import { ensureThread, persistThread, setThreadTitle } from "@/lib/chat-store";
import { addNote, loadNotes, removeNote, retrieveContext, type NoteDoc } from "@/lib/notes-store";
import { extractFileText } from "@/lib/pdf-text";


export const Route = createFileRoute("/chat/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shiva AI" },
      {
        name: "description",
        content: "Ask Shiva AI any study question and get clear, step-by-step explanations.",
      },
      { property: "og:title", content: "Chat with Shiva AI" },
      {
        property: "og:description",
        content: "Ask Shiva AI any study question and get clear, step-by-step explanations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const { threadId } = Route.useParams();
  const initial = useMemo(() => ensureThread(threadId), [threadId]);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastTitleMessageCount = useRef(0);
  const [notes, setNotes] = useState<NoteDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initial.messages,
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  useEffect(() => {
    if (messages.length > 0) persistThread(threadId, messages);
  }, [messages, status, threadId]);

  // Ask the configured AI provider to title the whole conversation after each
  // completed assistant turn, rather than using the first user prompt as title.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (
      status !== "ready" ||
      messages.length < 2 ||
      lastMessage?.role !== "assistant" ||
      lastTitleMessageCount.current === messages.length
    ) return;

    lastTitleMessageCount.current = messages.length;
    const conversation = messages.map((message) => ({
      role: message.role,
      text: message.parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .join(" ")
        .trim(),
    }));

    void fetch("/api/title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Title generation unavailable");
        return response.json() as Promise<{ title?: string }>;
      })
      .then((result) => {
        if (result.title) setThreadTitle(threadId, result.title);
      })
      .catch((titleError) => {
        console.warn("Shiva AI could not update this chat title:", titleError);
      });
  }, [messages, status, threadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId, isBusy]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const text = await extractFileText(file);
        if (!text.trim()) {
          setUploadError(`Couldn't read any text from "${file.name}".`);
          continue;
        }
        addNote(file.name, text);
      }
      setNotes(loadNotes());
    } catch {
      setUploadError("That file couldn't be processed. Try a PDF or a .txt file.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    const noteContext = retrieveContext(text);
    void sendMessage({ text }, { body: { noteContext } });
  }


  const empty = messages.length === 0;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 blur-3xl"
        style={{ background: "var(--glow)" }}
      />
      <ShivaSidebar activeThreadId={threadId} />

      <main className="relative z-10 ml-14 flex min-h-[100svh] flex-col items-center px-3 sm:px-5">
        {empty ? (
          <div className="flex w-full max-w-2xl flex-1 flex-col justify-center gap-7 py-8">
            <div className="space-y-3 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-lg shadow-primary/10"><Sparkles className="h-7 w-7" /></div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">What are we learning today?</h1>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">Ask a question, explore a concept, or get help with your study plan.</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: BookOpen, title: "Explain a concept", prompt: "Explain a difficult concept in simple steps with an example." },
                { icon: Lightbulb, title: "Give me ideas", prompt: "Give me some creative ideas to improve my learning." },
                { icon: Atom, title: "Solve a problem", prompt: "Help me solve a physics or chemistry problem step by step." },
                { icon: Sparkles, title: "Make a study plan", prompt: "Help me make a realistic study plan for today." },
              ].map(({ icon: Icon, title, prompt }) => (
                <button key={title} type="button" onClick={() => setInput(prompt)} className="group flex min-h-24 flex-col items-start justify-between rounded-2xl border border-border/70 bg-card/70 p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card active:scale-[.98]">
                  <Icon className="h-4 w-4 text-primary transition-transform group-hover:scale-110" />
                  <span className="text-xs font-medium text-foreground">{title}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <h1 className="pt-6 text-lg font-semibold tracking-tight">Shiva AI</h1>
            <section className="mt-4 flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto pb-4">
              {messages.map((m) => {
                const text = m.parts
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("");
                return m.role === "user" ? (
                  <p
                    key={m.id}
                    className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-[1.35rem] rounded-br-md border border-primary/20 bg-primary px-4 py-3 text-[14px] leading-relaxed text-primary-foreground shadow-sm sm:max-w-[82%]"
                  >
                    {text}
                  </p>
                ) : (
                  <div
                    key={m.id}
                    className="mr-auto w-full max-w-[96%] space-y-3 rounded-2xl rounded-tl-md border border-border/60 bg-card/55 px-4 py-3.5 text-[14px] leading-7 text-foreground shadow-sm [&_a]:text-primary [&_a]:underline [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-secondary [&_pre]:p-4 [&_ul]:list-disc"
                  >
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                );
              })}
              {status === "submitted" && (
                <p className="mr-auto animate-pulse text-sm text-muted-foreground">Thinking…</p>
              )}
              {error && (
                <p role="alert" className="mr-auto max-w-[92%] rounded-xl bg-destructive/15 px-4 py-3 text-sm text-destructive">
                  {error.message || "The message could not be sent. Please try again."}
                </p>
              )}
              <div ref={endRef} />
            </section>
          </>
        )}

        <div className={empty ? "w-full max-w-2xl pb-10" : "w-full max-w-2xl pb-6"}>
          {(notes.length > 0 || uploadError) && (
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
              {notes.map((n) => (
                <span
                  key={n.id}
                  className="flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span className="max-w-[160px] truncate text-foreground">{n.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${n.name}`}
                    onClick={() => {
                      removeNote(n.id);
                      setNotes(loadNotes());
                    }}
                    className="transition-opacity hover:opacity-70"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              {uploadError && <span className="text-xs text-destructive">{uploadError}</span>}
            </div>
          )}

          <form
            onSubmit={submit}
            className="flex items-end gap-2 rounded-[1.7rem] border border-border/80 bg-card/95 px-3 py-2.5 shadow-[0_12px_40px_-18px_rgba(0,0,0,.7)] backdrop-blur-xl transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 sm:gap-3 sm:px-4"
          >
            <input
              ref={fileRef}
              id="chat-file-upload"
              name="chat-file-upload"
              type="file"
              accept=".pdf,.txt,.md,text/plain,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Upload notes or PDFs"
              aria-label="Upload notes or PDFs"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
            </button>
            <input
              ref={inputRef}
              id="chat-message"
              name="message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                notes.length > 0 ? "Ask about your notes..." : "Ask Shiva anything..."
              }
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              1.0 Rudra
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              aria-label="Send message"
              className="mb-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:bg-secondary disabled:text-muted-foreground disabled:shadow-none"
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-muted-foreground/75">Shiva AI can make mistakes. Check important information.</p>
        </div>

      </main>
    </div>
  );
}
