"use client";

import { useState, useEffect, useRef, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { isValidEmail } from "@/lib/constants";

type Step = "form" | "verify" | "success";

const HIDDEN_PATHS = ["/pricing", "/sign-in"];

export function SubscribeBanner() {
  const pathname = usePathname();

  if (HIDDEN_PATHS.includes(pathname)) return null;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [code, setCode] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [visible, setVisible] = useState(true);
  const codeRef = useRef<HTMLInputElement>(null);

  // Hide on scroll down
  useEffect(() => {
    let lastY = window.scrollY;
    function onScroll() {
      const y = window.scrollY;
      if (y > 80 && y > lastY) {
        setVisible(false);
        setOpen(false);
      } else if (y < 40) {
        setVisible(true);
      }
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
    setAlreadySubscribed(false);

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
      } else if (res.status === 409) {
        setAlreadySubscribed(true);
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
        if (data.loggedIn) {
          setTimeout(() => window.location.reload(), 1500);
        }
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

  function renderContent() {
    if (step === "success") {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200"
        >
          <div className="flex items-center gap-2">
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
          <p className="text-xs text-emerald-600">
            Check your inbox for a welcome email.
          </p>
        </motion.div>
      );
    }

    if (step === "verify") {
      return (
        <form onSubmit={handleVerify} className="flex flex-col gap-2">
          <p className="text-center text-sm text-[var(--color-text-secondary)]">
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
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="h-10 shrink-0 rounded-lg bg-[var(--color-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:opacity-60 transition-colors"
            >
              {loading ? "..." : "Verify"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleResend}
            disabled={loading}
            className="mt-1 text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors cursor-pointer disabled:opacity-60"
          >
            Didn&apos;t receive it? Resend code
          </button>
        </form>
      );
    }

    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
          <button
            type="submit"
            disabled={loading}
            className="h-10 shrink-0 rounded-lg bg-[var(--color-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:opacity-60 transition-colors"
          >
            {loading ? "..." : "Sign up"}
          </button>
        </div>
        {alreadySubscribed && (
          <p className="text-xs text-red-600">
            This email is already subscribed.{" "}
            <a href="/sign-in" className="underline hover:text-red-700">
              Sign in instead
            </a>
          </p>
        )}
        {error && !alreadySubscribed && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </form>
    );
  }

  return (
    <>
      {/* Trigger bar — sits above the header */}
      <div
        className="sticky top-0 z-[60] transition-transform duration-300 ease-out"
        style={{ transform: visible ? "translateY(0)" : "translateY(-100%)" }}
      >
        <button
          onClick={() => setOpen(!open)}
          className="group flex w-full items-center justify-center gap-2 bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none"
        >
          <span className="font-[family-name:var(--font-heading)] tracking-tight">
            Create your free account
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            className="transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path
              d="M3.5 5.25L7 8.75L10.5 5.25"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Dropdown panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
              className="overflow-hidden"
            >
              <div className="border-b border-[var(--color-border)] bg-[var(--color-bg-base)]/95 backdrop-blur-xl">
                <div className="mx-auto max-w-md px-4 py-5">
                  <p className="mb-1 text-center font-[family-name:var(--font-heading)] text-base font-bold tracking-tight text-[var(--color-text-primary)]">
                    Never miss a week in Bitcoin
                  </p>
                  <p className="mb-4 text-center text-xs text-[var(--color-text-muted)]">
                    Free weekly e-mail recaps, daily market updates & top stories
                  </p>

                  {renderContent()}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
