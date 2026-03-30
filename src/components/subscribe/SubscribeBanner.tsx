"use client";

import { useState, useEffect, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Status = "idle" | "loading" | "success" | "error";

export function SubscribeBanner() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(true);

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

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || trimmedName.length > 50) {
      setStatus("error");
      setMessage(trimmedName.length > 50 ? "Name must be 50 characters or fewer" : "First name is required");
      return;
    }

    if (!trimmedEmail || trimmedEmail.length > 254 || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmedEmail)) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      return;
    }

    setStatus("loading");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setMessage(data.message ?? "You're in!");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Something went wrong");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Try again.");
    }
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
                    Access daily Bitcoin intelligence
                  </p>
                  <p className="mb-4 text-center text-xs text-[var(--color-text-muted)]">
                    Free access to daily briefings, market data & a weekly email recap
                  </p>

                  {status === "success" ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200"
                    >
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
                      {message}
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
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
                            if (status === "error") setStatus("idle");
                          }}
                          placeholder="you@example.com"
                          aria-label="Email address"
                          className="h-10 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={status === "loading"}
                          className="h-10 shrink-0 rounded-lg bg-[var(--color-accent)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:opacity-60 transition-colors"
                        >
                          {status === "loading" ? "..." : "Sign up"}
                        </button>
                      </div>
                      {status === "error" && (
                        <p className="text-xs text-red-600">{message}</p>
                      )}
                    </form>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
