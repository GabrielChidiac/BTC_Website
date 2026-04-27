"use client";

import { useEffect, useState } from "react";

interface TipThanksPollerProps {
  sessionId: string;
}

interface PollResponse {
  success: boolean;
  paid?: boolean;
  amount_cents?: number;
  currency?: string;
}

const POLL_ATTEMPTS = 3;
const POLL_INTERVAL_MS = 2000;

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function TipThanksPoller({ sessionId }: TipThanksPollerProps) {
  const [status, setStatus] = useState<"polling" | "confirmed" | "pending">("polling");
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function poll() {
      attempt += 1;
      if (cancelled) return;
      try {
        const res = await fetch(`/api/tips/stripe/${encodeURIComponent(sessionId)}`);
        if (cancelled) return;
        if (res.ok) {
          const data: PollResponse = await res.json();
          if (data.paid) {
            setAmountCents(data.amount_cents ?? null);
            setStatus("confirmed");
            return;
          }
        }
      } catch {
        // network blip; continue
      }

      setAttempts(attempt);
      if (attempt >= POLL_ATTEMPTS) {
        setStatus("pending");
        return;
      }

      window.setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "confirmed") {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderColor: "var(--color-border)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 30px -16px rgba(0,0,0,0.12)",
        }}
      >
        <div
          className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--color-bullish)",
            boxShadow: "0 0 0 8px rgba(20,184,166,0.12)",
          }}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <path
              d="M7 14.5L12 19.5L21 9.5"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2
          className="mb-2 font-[family-name:var(--font-heading)] text-3xl font-medium tabular-nums tracking-[-0.04em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          {amountCents !== null ? `Received ${formatUsd(amountCents)}.` : "Tip received."}
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Thank you. The brief continues.
        </p>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div
        className="rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: "var(--color-bg-surface)",
          borderColor: "var(--color-border)",
        }}
      >
        <h2
          className="mb-2 font-[family-name:var(--font-heading)] text-2xl font-medium tracking-[-0.04em]"
          style={{ color: "var(--color-text-primary)" }}
        >
          We&apos;ll confirm shortly.
        </h2>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Stripe is finishing up. Check your email for the receipt. Statement: BTC TODAY TIP.
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-8 text-center"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <p
        className="font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{ color: "var(--color-text-muted)" }}
      >
        Confirming{".".repeat(attempts || 1)}
      </p>
      <p
        className="mt-3 text-sm leading-relaxed"
        style={{ color: "var(--color-text-secondary)" }}
      >
        Just a moment while Stripe sends the confirmation.
      </p>
    </div>
  );
}
