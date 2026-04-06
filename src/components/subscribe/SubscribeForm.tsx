"use client";

import { useState, useRef, type FormEvent } from "react";
import { MotionButton } from "@/components/ui/MotionButton";
import { isValidEmail } from "@/lib/constants";

type Step = "form" | "verify" | "success";

export function SubscribeForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (website) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length > 50) {
      setError(trimmedName.length > 50 ? "Name must be 50 characters or fewer" : "First name is required");
      return;
    }

    if (!trimmedEmail || trimmedEmail.length > 254 || !isValidEmail(trimmedEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: trimmedName }),
      });

      const data = await res.json();

      if (res.ok && data.step === "verify") {
        setStep("verify");
        setTimeout(() => codeRef.current?.focus(), 100);
      } else if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();

    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/subscribe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: trimmedCode }),
      });

      const data = await res.json();

      if (res.ok) {
        setStep("success");
        setSuccessMessage(data.message ?? "You're in!");
      } else {
        setError(data.error ?? "Invalid code");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setCode("");
        setError(null);
      } else {
        setError(data.error ?? "Could not resend code");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "success") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200">
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.2" />
          <path
            d="M5 8.5l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {successMessage}
      </div>
    );
  }

  if (step === "verify") {
    return (
      <div className="w-full max-w-sm">
        <form onSubmit={handleVerify} className="flex flex-col gap-2">
          <p className="text-sm text-[var(--color-text-secondary)]">
            We sent a 6-digit code to <strong className="text-[var(--color-text-primary)]">{email.trim()}</strong>
          </p>
          <div className="flex items-center gap-2">
            <input
              ref={codeRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (error) setError(null);
              }}
              placeholder="000000"
              aria-label="Verification code"
              className="h-10 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-center font-[family-name:var(--font-heading)] text-lg font-bold tracking-[0.2em] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] placeholder:font-normal placeholder:tracking-[0.2em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors"
            />
            <MotionButton
              type="submit"
              disabled={loading || code.length !== 6}
              className="h-10 shrink-0 rounded-lg bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:opacity-60"
            >
              {loading ? "..." : "Verify"}
            </MotionButton>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="mt-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer disabled:opacity-60"
          >
            Didn&apos;t receive it? Resend code
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2"
      >
        {/* Honeypot field — invisible to real users, catches bots */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 overflow-hidden"
        />
        <input
          type="text"
          required
          maxLength={50}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name"
          aria-label="First name"
          className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors"
        />
        <div className="flex items-center gap-2">
          <input
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(null);
            }}
            placeholder="you@example.com"
            aria-label="Email address"
            className="h-10 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors"
          />
          <MotionButton
            type="submit"
            disabled={loading}
            className="h-10 shrink-0 rounded-lg bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:opacity-60"
          >
            {loading ? "..." : "Sign up"}
          </MotionButton>
        </div>
      </form>
      {error && (
        <p className="mt-2 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
