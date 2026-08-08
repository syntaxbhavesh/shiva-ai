import { createFileRoute } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shiva AI — Study Assistant for Students" },
      {
        name: "description",
        content:
          "Ask Shiva AI any study question and get clear, step-by-step explanations instantly.",
      },
      { property: "og:title", content: "Shiva AI — Study Assistant for Students" },
      {
        property: "og:description",
        content:
          "Ask Shiva AI any study question and get clear, step-by-step explanations instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const endRef = useRef<HTMLDivElement>(null);
  const isBusy = status === "submitted" || status === "streaming";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    setInput("");
    void sendMessage({ text });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 blur-3xl"
        style={{ background: "var(--glow)" }}
      />

      <header className="relative z-10 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Shiva AI</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your study companion — ask anything, get clear answers.
        </p>
      </header>

      <section className="relative z-10 mt-8 flex w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="mt-16 text-center text-sm text-muted-foreground">
            Try: “Explain photosynthesis in simple steps”
          </div>
        )}

        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={
                isUser
                  ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground"
                  : "mr-auto max-w-[90%] rounded-2xl bg-card px-4 py-3 text-card-foreground shadow-lg"
              }
            >
              {isUser ? (
                <p className="whitespace-pre-wrap text-sm">{text}</p>
              ) : (
                <div className="prose-shiva space-y-3 text-sm leading-relaxed [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-secondary [&_pre]:p-4 [&_ul]:list-disc">
                  <ReactMarkdown>{text}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        })}

        {status === "submitted" && (
          <div className="mr-auto rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">
            Thinking…
          </div>
        )}
        {error && (
          <div className="mr-auto rounded-2xl bg-destructive/15 px-4 py-3 text-sm text-destructive">
            Something went wrong. Please try again in a moment.
          </div>
        )}
        <div ref={endRef} />
      </section>

      <form
        onSubmit={submit}
        className="relative z-10 mt-6 flex w-full max-w-2xl items-center gap-2 rounded-full bg-card px-4 py-2 shadow-2xl"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Shiva anything..."
          className="flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={isBusy || !input.trim()}
          className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>

      <p className="relative z-10 mt-4 text-xs text-muted-foreground">
        Powered by <span className="font-semibold text-accent">BOOKStore</span>
      </p>
    </main>
  );
}
