import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChevronDown, FileText, Loader2, Plus, SendHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ShivaSidebar } from "@/components/ShivaSidebar";
import { ensureThread, persistThread } from "@/lib/chat-store";
import { addNote, loadNotes, removeNote, retrieveContext, type NoteDoc } from "@/lib/notes-store";
import { extractFileText } from "@/lib/pdf-text";


export const Route = createFileRoute("/chat/$threadId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Chat with Shiva AI — Student Study Assistant" },
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

      <main className="relative z-10 ml-14 flex min-h-screen flex-col items-center px-4">
        {empty ? (
          <div className="flex flex-1 items-center justify-center">
            <h1 className="text-4xl font-semibold tracking-tight">Shiva AI</h1>
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
                    className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground"
                  >
                    {text}
                  </p>
                ) : (
                  <div
                    key={m.id}
                    className="mr-auto max-w-[92%] space-y-3 text-sm leading-relaxed text-foreground [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-secondary [&_pre]:p-4 [&_ul]:list-disc"
                  >
                    <ReactMarkdown>{text}</ReactMarkdown>
                  </div>
                );
              })}
              {status === "submitted" && (
                <p className="mr-auto animate-pulse text-sm text-muted-foreground">Thinking…</p>
              )}
              {error && (
                <p className="mr-auto rounded-xl bg-destructive/15 px-4 py-3 text-sm text-destructive">
                  Something went wrong. Please try again in a moment.
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
            className="flex items-center gap-3 rounded-full bg-card px-4 py-3 shadow-2xl"
          >
            <input
              ref={fileRef}
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                notes.length > 0 ? "Ask about your notes..." : "Ask Shiva anything..."
              }
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              1.0 Neo
              <ChevronDown className="h-3.5 w-3.5" />
            </span>
            <button
              type="submit"
              disabled={isBusy || !input.trim()}
              aria-label="Send message"
              className="text-foreground transition-opacity disabled:opacity-40"
            >
              <SendHorizontal className="h-5 w-5" />
            </button>
          </form>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-accent">BOOKStore</span>
          </p>
        </div>

      </main>
    </div>
  );
}
