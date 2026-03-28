"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

const STARTERS = [
  "What's happening with Bitcoin today?",
  "Explain the halving to me",
  "How do I store Bitcoin safely?",
  "What is the Lightning Network?",
];

export function ChatInterface({ email, legacyToken, onSessionExpired }: { email: string; legacyToken?: string; onSessionExpired: () => void }) {
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
        credentials: "same-origin",
        body: JSON.stringify({
          message: text.trim(),
          email,
          ...(legacyToken && { token: legacyToken }),
          history: messages,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          onSessionExpired();
          return;
        }
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
              <div className="relative mb-5">
                <div className="absolute inset-0 rounded-full bg-[var(--color-accent)]/20 blur-xl scale-150" />
                <span className="relative text-5xl">₿</span>
              </div>
              <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-text-primary)] tracking-[-0.03em]">
                Ask me anything about Bitcoin
              </h2>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-sm leading-relaxed">
                I know today&apos;s market data, news, and expert insights. Try one of these:
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {STARTERS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:shadow-[0_0_12px_var(--color-accent-glow)] transition-all duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex items-end gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-accent)]/25 border border-[var(--color-accent)]/20 flex items-center justify-center mb-0.5">
                      <span className="text-xs font-bold text-[var(--color-accent)]">₿</span>
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-[#F7931A] to-[#E67E0D] text-white rounded-br-sm shadow-[0_2px_12px_rgba(247,147,26,0.35)]"
                        : "bg-white/80 backdrop-blur-sm border border-[var(--color-border)]/60 text-[var(--color-text-primary)] rounded-bl-sm shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex items-end gap-2.5 justify-start">
                  <div className="shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-accent)]/10 to-[var(--color-accent)]/25 border border-[var(--color-accent)]/20 flex items-center justify-center mb-0.5">
                    <span className="text-xs font-bold text-[var(--color-accent)]">₿</span>
                  </div>
                  <div className="bg-white/80 backdrop-blur-sm border border-[var(--color-border)]/60 rounded-2xl rounded-bl-sm px-4 py-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                    <div className="flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]/40 animate-pulse" />
                      <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]/40 animate-pulse [animation-delay:0.2s]" />
                      <span className="h-2 w-2 rounded-full bg-[var(--color-accent)]/40 animate-pulse [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--color-border)]/50 bg-[var(--color-bg-base)]/90 backdrop-blur-lg px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto max-w-2xl flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about Bitcoin..."
            disabled={loading}
            className="flex-1 rounded-xl border border-[var(--color-border)]/60 bg-white/70 backdrop-blur-sm px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 focus-visible:border-[var(--color-accent)]/30 transition-all duration-200 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-b from-[#F7931A] to-[#E67E0D] px-5 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(247,147,26,0.3)] hover:shadow-[0_4px_16px_rgba(247,147,26,0.4)] hover:from-[#E8850F] hover:to-[#D4750A] transition-all duration-200 disabled:opacity-40 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.97] shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
