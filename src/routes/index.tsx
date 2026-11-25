import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { bookstoreAuth } from "@/lib/bookstore-firebase";
import { loadThreads, newThreadId } from "@/lib/chat-store";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shiva AI — BOOKStore" },
      { name: "description", content: "Ask Shiva AI any study question and get clear, step-by-step explanations instantly." },
      { property: "og:title", content: "Shiva AI — BOOKStore" },
      { property: "og:description", content: "Ask Shiva AI any study question and get clear explanations instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(bookstoreAuth, (user) => {
      if (!active) return;
      const latest = loadThreads()[0];
      void navigate({
        to: "/chat/$threadId",
        params: { threadId: latest?.id ?? newThreadId() },
        replace: true,
      });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  return <div className="min-h-screen bg-background" />;
}
