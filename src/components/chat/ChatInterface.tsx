"use client";

import { useState, useRef, useEffect } from "react";
import type { ChatMessage } from "@/lib/types";

export function ChatInterface({ email, legacyToken, onSessionExpired, starters }: { email: string; legacyToken?: string; onSessionExpired: () => void; starters: string[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load conversation history on mount
  useEffect(() => {
    fetch("/api/chat/history", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (data.conversationId && Array.isArray(data.messages) && data.messages.length > 0) {
          conversationIdRef.current = data.conversationId;
          setMessages(data.messages);

          // Check if conversation is stale (last updated >12 hours ago)
          if (data.updatedAt) {
            const lastUpdated = new Date(data.updatedAt).getTime();
            const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
            if (lastUpdated < twelveHoursAgo) {
              setIsStale(true);
            }
          }
        }
      })
      .catch(() => {})
      .finally(() => setHistoryLoaded(true));
  }, []);

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
          ...(conversationIdRef.current && { conversationId: conversationIdRef.current }),
        }),
      });

      // Non-streaming error responses (JSON)
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Something went wrong" }));
        if (res.status === 401) {
          onSessionExpired();
          return;
        }
        if (res.status === 403 && data.error?.includes("Pro subscription required")) {
          setMessages([
            ...updated,
            { role: "assistant", content: "AI Chat is available for Pro subscribers. Upgrade to Pro to unlock conversations about today's briefing data." },
          ]);
          setLoading(false);
          return;
        }
        setMessages([
          ...updated,
          { role: "assistant", content: data.error || "Something went wrong. Please try again." },
        ]);
        setLoading(false);
        return;
      }

      // Streaming SSE response
      if (!res.body) {
        setMessages([...updated, { role: "assistant", content: "No response received." }]);
        setLoading(false);
        return;
      }

      // Add empty assistant message that we'll fill incrementally
      const assistantIdx = updated.length;
      setMessages([...updated, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const chunk of lines) {
          const trimmed = chunk.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) {
              fullText += "\n\n[Response interrupted. Please try again.]";
            } else if (parsed.conversationId) {
              conversationIdRef.current = parsed.conversationId;
            } else if (parsed.text) {
              fullText += parsed.text;
            }
          } catch { /* skip malformed */ }
        }

        // Update the assistant message in place
        setMessages((prev) => {
          const next = [...prev];
          if (next[assistantIdx]) {
            next[assistantIdx] = { role: "assistant", content: fullText };
          }
          return next;
        });
      }

      // Final update in case buffer has remaining data
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ")) {
          const payload = trimmed.slice(6);
          if (payload !== "[DONE]") {
            try {
              const parsed = JSON.parse(payload);
              if (parsed.text) fullText += parsed.text;
            } catch { /* skip */ }
          }
        }
        setMessages((prev) => {
          const next = [...prev];
          if (next[assistantIdx]) {
            next[assistantIdx] = { role: "assistant", content: fullText };
          }
          return next;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.content !== ""),
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

  function startNewConversation() {
    conversationIdRef.current = null;
    setMessages([]);
    setInput("");
  }

  return (
    <div className="flex flex-col h-[calc(100vh-57px-1px)]">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-2xl">
          {!historyLoaded ? (
            <div className="flex items-center justify-center min-h-[50vh]">
              <span className="text-sm text-[var(--color-text-muted)]">Loading...</span>
            </div>
          ) : messages.length === 0 ? (
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
                {starters.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:shadow-[0_0_12px_var(--color-accent-glow)] transition-colors duration-200"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Stale conversation warning */}
              {isStale && (
                <div className="flex items-center gap-3 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-3">
                  <p className="flex-1 text-xs text-[var(--color-text-secondary)]">
                    This conversation is from a previous session. The market data has been refreshed since then.
                  </p>
                  <button
                    onClick={() => { startNewConversation(); setIsStale(false); }}
                    className="shrink-0 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    Start fresh
                  </button>
                </div>
              )}
              {/* New conversation button */}
              <div className="flex justify-end">
                <button
                  onClick={() => { startNewConversation(); setIsStale(false); }}
                  disabled={loading}
                  className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors disabled:opacity-40"
                >
                  New conversation
                </button>
              </div>
              {messages.map((msg, i) => {
                // Skip rendering empty assistant messages (streaming placeholder before first chunk)
                if (msg.role === "assistant" && !msg.content) return null;
                return (
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
                );
              })}
              {/* Show bouncing dots only while waiting for first stream chunk */}
              {loading && messages[messages.length - 1]?.role === "user" && (
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
            className="flex-1 rounded-xl border border-[var(--color-border)]/60 bg-white/70 backdrop-blur-sm px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 focus-visible:border-[var(--color-accent)]/30 transition-colors duration-200 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-b from-[#F7931A] to-[#E67E0D] px-5 py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(247,147,26,0.3)] hover:shadow-[0_4px_16px_rgba(247,147,26,0.4)] hover:from-[#E8850F] hover:to-[#D4750A] transition-[opacity,transform,box-shadow] duration-200 disabled:opacity-40 disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.97] shrink-0"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
