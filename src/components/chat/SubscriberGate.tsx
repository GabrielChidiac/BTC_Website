"use client";

import { useState } from "react";

export function SubscriberGate({
  onVerified,
}: {
  onVerified: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmed = email.trim().toLowerCase();

    try {
      // Try to verify by sending a test message
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "hello",
          email: trimmed,
          history: [],
        }),
      });

      if (res.status === 403) {
        setError("This email is not subscribed. Subscribe first to access the chatbot.");
        setLoading(false);
        return;
      }

      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      // Success — save email and proceed
      localStorage.setItem("btc-today-email", trimmed);
      onVerified(trimmed);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="text-4xl">💬</span>
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
          Bitcoin AI Assistant
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Ask any question about Bitcoin: technology, investing, regulation, security, and more.
          Our AI assistant knows today&apos;s market data and news.
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Available exclusively to subscribers.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your subscriber email"
            required
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
          >
            {loading ? "Verifying..." : "Access Chat"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <p className="mt-6 text-xs text-[var(--color-text-muted)]">
          Not subscribed yet?{" "}
          <a href="/" className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
            Subscribe on the homepage
          </a>
        </p>
      </div>
    </div>
  );
}
