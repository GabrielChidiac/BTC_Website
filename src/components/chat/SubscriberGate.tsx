"use client";

import { useState, useEffect } from "react";

export function SubscriberGate({
  onVerified,
  verifyError,
}: {
  onVerified: (email: string) => void;
  verifyError?: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(verifyError || "");
  const [sent, setSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync external error
  useEffect(() => {
    if (verifyError) setError(verifyError);
  }, [verifyError]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function handleSendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setError("");
    setLoading(true);

    const trimmed = email.trim().toLowerCase();

    try {
      const res = await fetch("/api/chat/verify-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(
          res.status === 403
            ? "This email is not subscribed. Subscribe first to access the chatbot."
            : res.status === 429
              ? data.error
              : data.error || "Something went wrong. Please try again."
        );
        setLoading(false);
        return;
      }

      setSent(true);
      setResendCooldown(60);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Keep onVerified reference to satisfy lint — it's used via magic link redirect
  void onVerified;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <span className="text-4xl">💬</span>
        </div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
          Bitcoin AI Assistant
        </h2>

        {!sent ? (
          <>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Ask any question about Bitcoin: technology, investing, regulation,
              security, and more. Our AI assistant knows today&apos;s market
              data and news.
            </p>
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Available exclusively to subscribers. We&apos;ll send a link to
              your email to verify access.
            </p>

            <form onSubmit={handleSendLink} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="Enter your subscriber email"
                required
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
              >
                {loading ? "Sending..." : "Send access link"}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
              <p className="text-sm text-[var(--color-text-primary)] font-medium">
                Check your inbox
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                We sent a link to{" "}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {email.trim().toLowerCase()}
                </span>
                . Click it to access the chat.
              </p>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                The link expires in 10 minutes. Check your spam folder if you
                don&apos;t see it.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[var(--color-text-muted)]">
              <button
                onClick={() => {
                  setSent(false);
                  setError("");
                }}
                className="hover:text-[var(--color-text-secondary)] transition-colors"
              >
                Change email
              </button>
              <span className="text-[var(--color-border)]">|</span>
              <button
                onClick={() => handleSendLink()}
                disabled={resendCooldown > 0 || loading}
                className="hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend link (${resendCooldown}s)`
                  : "Resend link"}
              </button>
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {!sent && (
          <p className="mt-6 text-xs text-[var(--color-text-muted)]">
            Not subscribed yet?{" "}
            <a
              href="/"
              className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              Subscribe on the homepage
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
