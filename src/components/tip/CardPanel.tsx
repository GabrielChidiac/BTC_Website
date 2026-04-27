"use client";

import { useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import {
  TIP_PRESETS_CENTS,
  TIP_MAX_CENTS,
  TIP_MESSAGE_MAX_LEN,
} from "@/lib/constants";

interface CardPanelProps {
  briefingDate?: string;
  source: "site" | "newsletter" | "archive" | "footer";
}

const UI_MIN_CENTS = 500; // $5 floor in the UI; DB allows down to $1.

// Same shape as src/lib/validation.ts emailBase — keep loose; server is the
// authoritative validator. We just want to catch obvious typos client-side.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

export function CardPanel({ briefingDate, source }: CardPanelProps) {
  const [amountCents, setAmountCents] = useState<number>(2_100);
  const [customAmount, setCustomAmount] = useState("");
  const [usingCustom, setUsingCustom] = useState(false);
  const [tipperEmail, setTipperEmail] = useState("");
  const [tipperName, setTipperName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function effectiveCents(): number {
    if (!usingCustom) return amountCents;
    const dollars = parseFloat(customAmount);
    if (!Number.isFinite(dollars) || dollars <= 0) return 0;
    return Math.round(dollars * 100);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const email = tipperEmail.trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      setError("Enter a valid email so we can send you a receipt.");
      return;
    }

    const name = tipperName.trim();
    if (!name) {
      setError("Add a first name so we can address you properly.");
      return;
    }

    const cents = effectiveCents();
    if (cents < UI_MIN_CENTS) {
      setError(`Minimum tip is ${formatUsd(UI_MIN_CENTS)}`);
      return;
    }
    if (cents > TIP_MAX_CENTS) {
      setError(`Maximum tip is ${formatUsd(TIP_MAX_CENTS)}`);
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        amount_cents: cents,
        tipper_email: email,
        tipper_name: name,
        source,
      };
      if (message.trim()) body.message = message.trim();
      if (briefingDate) body.briefing_date = briefingDate;

      const res = await fetch("/api/tips/stripe-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.url) {
        setError(data.error ?? "Could not start checkout");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border p-6 sm:p-8"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderColor: "var(--color-border)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 30px -16px rgba(0,0,0,0.12)",
      }}
    >
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <label
            htmlFor="card-tip-email"
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Email (required)
          </label>
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            For receipt
          </span>
        </div>
        <input
          id="card-tip-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          value={tipperEmail}
          onChange={(e) => setTipperEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-10 w-full rounded-lg border px-3 text-sm outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-primary)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
        />
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <label
            htmlFor="card-tip-name"
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            First name (required)
          </label>
          <span
            className="font-mono text-[10px] tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            {tipperName.length}/80
          </span>
        </div>
        <input
          id="card-tip-name"
          type="text"
          required
          autoComplete="given-name"
          maxLength={80}
          value={tipperName}
          onChange={(e) => setTipperName(e.target.value)}
          placeholder="Your first name"
          className="h-10 w-full rounded-lg border px-3 text-sm outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-primary)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
        />
      </div>

      <div className="mb-3 flex items-baseline justify-between">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Amount
        </span>
        <span
          className="font-mono text-[10px]"
          style={{ color: "var(--color-text-muted)" }}
        >
          USD
        </span>
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {TIP_PRESETS_CENTS.map((preset) => {
          const selected = !usingCustom && amountCents === preset;
          const isFlagship = preset === 2_100;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => {
                setAmountCents(preset);
                setUsingCustom(false);
                setCustomAmount("");
              }}
              className="relative flex h-12 items-center justify-center rounded-lg border font-[family-name:var(--font-heading)] text-sm font-medium tabular-nums tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
              style={{
                backgroundColor: selected
                  ? "var(--color-accent)"
                  : "var(--color-bg-base)",
                color: selected ? "#FFFFFF" : "var(--color-text-primary)",
                borderColor: selected
                  ? "var(--color-accent)"
                  : "var(--color-border)",
                transition:
                  "background-color 150ms ease, color 150ms ease, border-color 150ms ease",
              }}
            >
              {formatUsd(preset)}
              {isFlagship && !selected && (
                <span
                  className="absolute -top-1.5 right-1 font-mono text-[8px] uppercase tracking-[0.18em]"
                  style={{ color: "var(--color-accent)" }}
                  aria-hidden="true"
                >
                  21M
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-6">
        <div
          className="flex h-10 items-center rounded-lg border px-3"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: usingCustom
              ? "var(--color-accent)"
              : "var(--color-border)",
            transition: "border-color 150ms ease",
          }}
        >
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Custom
          </span>
          <span
            className="ml-3 font-[family-name:var(--font-heading)] text-sm font-medium"
            style={{ color: "var(--color-text-muted)" }}
            aria-hidden="true"
          >
            $
          </span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={customAmount}
            onChange={(e) => {
              const v = e.target.value
                .replace(/[^0-9.]/g, "")
                .replace(/(\..*)\./g, "$1")
                .slice(0, 7);
              setCustomAmount(v);
              setUsingCustom(v.length > 0);
            }}
            className="ml-1 flex-1 bg-transparent text-right font-[family-name:var(--font-heading)] text-sm font-medium tabular-nums tracking-tight outline-none placeholder:text-[var(--color-text-muted)]"
            style={{ color: "var(--color-text-primary)" }}
            aria-label="Custom amount in USD"
          />
          <span
            className="ml-2 font-mono text-[10px]"
            style={{ color: "var(--color-text-muted)" }}
          >
            USD
          </span>
        </div>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <label
            htmlFor="card-tip-message"
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--color-text-muted)" }}
          >
            Note (optional)
          </label>
          <span
            className="font-mono text-[10px] tabular-nums"
            style={{ color: "var(--color-text-muted)" }}
          >
            {message.length}/{TIP_MESSAGE_MAX_LEN}
          </span>
        </div>
        <textarea
          id="card-tip-message"
          rows={2}
          maxLength={TIP_MESSAGE_MAX_LEN}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A line, if you'd like."
          className="w-full resize-none rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-[var(--color-text-muted)] focus:ring-2 focus:ring-[var(--color-accent)]/50"
          style={{
            backgroundColor: "var(--color-bg-base)",
            borderColor: "var(--color-border)",
            color: "var(--color-text-primary)",
            transition: "border-color 150ms ease, box-shadow 150ms ease",
          }}
        />
      </div>

      <motion.button
        type="submit"
        disabled={loading}
        whileTap={{ scale: 0.98 }}
        className="flex h-12 w-full items-center justify-center rounded-lg font-[family-name:var(--font-heading)] text-sm font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:opacity-60"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "#FFFFFF",
          boxShadow: "0 8px 20px -10px var(--color-accent-glow-strong)",
          transition: "background-color 150ms ease",
        }}
      >
        {loading ? (
          <span className="font-mono text-xs uppercase tracking-[0.18em]">
            Redirecting
          </span>
        ) : (
          <span>Continue to checkout</span>
        )}
      </motion.button>

      {error && (
        <p className="mt-3 text-xs" style={{ color: "var(--color-bearish)" }}>
          {error}
        </p>
      )}

      <div
        className="mt-6 border-t pt-4"
        style={{ borderColor: "var(--color-border)" }}
      >
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--color-text-muted)" }}
        >
          You will be redirected to Stripe. Card processed securely. Statement: BTC TODAY TIP.
        </p>
      </div>
    </form>
  );
}
