"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

const STARTERS = [
  "What's happening with Bitcoin today?",
  "Explain the halving to me",
  "How do I store Bitcoin safely?",
  "What is the Lightning Network?",
];

export function ChatInterface({ email, token }: { email: string; token: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text.trim(),
          email,
          token,
          history: messages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages([
          ...updated,
          { role: "assistant", content: data.error || "Something went wrong. Please try again." },
        ]);
      } else {
        setMessages([
          ...updated,
          { role: "assistant", content: data.message },
        ]);
      }
    } catch {
      setMessages([
        ...updated,
        { role: "assistant", content: "Network error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px-1px)]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
              <span className="text-5xl mb-4">₿</span>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-text-primary)]">
                Ask me anything about Bitcoin
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-sm">
                I know today&apos;s market data, news, and expert insights. Try one of these:
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)]/30 hover:text-[var(--color-accent)] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[var(--color-accent)] text-white rounded-br-md"
                        : "bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)] animate-pulse" />
                      <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:0.2s]" />
                      <span className="h-2 w-2 rounded-full bg-[var(--color-text-muted)] animate-pulse [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-base)]/80 backdrop-blur-md px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Bitcoin..."
            disabled={loading}
            className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98] shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
