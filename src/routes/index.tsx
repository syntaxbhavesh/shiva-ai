import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { loadThreads, newThreadId } from "@/lib/chat-store";

export const Route = createFileRoute("/")({
  ssr: false,
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
        content: "Ask Shiva AI any study question and get clear explanations instantly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    const latest = loadThreads()[0];
    void navigate({
      to: "/chat/$threadId",
      params: { threadId: latest?.id ?? newThreadId() },
      replace: true,
    });
  }, [navigate]);

  return <div className="min-h-screen bg-background" />;
}
