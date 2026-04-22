"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function SignInInner() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const searchParams = useSearchParams();
  const router = useRouter();
  const verifiedRef = useRef(false);

  // Handle magic link callback (?token=X&email=Y)
  useEffect(() => {
    if (verifiedRef.current) return;
    const magicToken = searchParams.get("token");
    const magicEmail = searchParams.get("email");

    if (magicToken && magicEmail) {
      verifiedRef.current = true;
      setVerifying(true);
      fetch("/api/auth/verify-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: magicEmail, token: magicToken }),
        credentials: "same-origin",
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            router.refresh();
            router.replace("/");
          } else {
            verifiedRef.current = false;
            setError(data.error || "Invalid or expired link. Try again.");
            setVerifying(false);
          }
        })
        .catch(() => {
          verifiedRef.current = false;
          setError("Network error. Please try again.");
          setVerifying(false);
        });
    }
  }, [searchParams, router]);

  // Resend cooldown timer
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
      const res = await fetch("/api/auth/verify-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
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

  if (verifying) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Logging you in...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-sm w-full text-center">
        <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
          Login
        </h1>

        {!sent ? (
          <>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Enter your subscriber email and we&apos;ll send you a login link.
            </p>

            <form onSubmit={handleSendLink} className="mt-6 flex flex-col gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="your@email.com"
                required
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
              >
                {loading ? "Sending..." : "Send login link"}
              </button>
            </form>

            <p className="mt-6 text-xs text-[var(--color-text-muted)]">
              Not subscribed yet?{" "}
              <a
                href="/"
                className="text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
              >
                Subscribe on the homepage
              </a>
            </p>
          </>
        ) : (
          <>
            <div className="mt-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
              <p className="text-sm text-[var(--color-text-primary)] font-medium">
                Check your inbox
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                We sent a login link to{" "}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {email.trim().toLowerCase()}
                </span>
              </p>
              <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                The link expires in 10 minutes. Check spam if you don&apos;t see it.
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
                  ? `Resend (${resendCooldown}s)`
                  : "Resend link"}
              </button>
            </div>
          </>
        )}

        {error && <p className="mt-3 text-sm text-[var(--color-bearish)]">{error}</p>}
      </div>
    </main>
  );
}

export function SignInContent() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center" />
      }
    >
      <SignInInner />
    </Suspense>
  );
}
