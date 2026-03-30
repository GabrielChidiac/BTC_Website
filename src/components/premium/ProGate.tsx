"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const PRO_FEATURES = [
  { label: "Daily Email Briefing", desc: "Full briefing delivered to your inbox" },
  { label: "Institutional Flows", desc: "ETF data, notable moves" },
  { label: "Technical Signals", desc: "RSI, SMAs, support & resistance" },
  { label: "Network Health", desc: "Hashrate, fees, halving countdown" },
  { label: "Expert Insights", desc: "Lyn Alden, Dylan LeClair, and more" },
  { label: "Forward Outlook", desc: "Macro, regulatory, technical analysis" },
  { label: "AI Chat", desc: "Ask questions about today's data" },
  { label: "PDF Downloads", desc: "1-page daily summary" },
  { label: "Full Archive", desc: "Access all historical briefings" },
];

export function ProGate() {
  return (
    <div className="mt-10 scroll-mt-16">
      <Card className="relative gap-0 overflow-hidden border-[var(--color-accent)]/20 py-0 ring-1 ring-[var(--color-accent)]/10">
        {/* Subtle accent glow at top */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/50 to-transparent" />

        <CardContent className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]">
                Pro
              </p>
              <h3 className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] sm:text-xl">
                Unlock the Deep Dive
              </h3>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                The full briefing continues with institutional-grade analysis below.
              </p>
            </div>
          </div>

          {/* Feature grid */}
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {PRO_FEATURES.map((f) => (
              <div key={f.label}>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {f.label}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] leading-snug">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>

          {/* CTA row */}
          <div className="mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
            >
              Go Pro — $69/year (save 36%)
            </Link>
            <Link
              href="/pricing"
              className="text-sm font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
            >
              or $9/month
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Compact version for archive pages and inline placements.
 */
export function ProGateCompact({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-bg-surface)] p-8 text-center">
      <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]">
        Pro
      </p>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-md">
        {message ?? "This content is available to Pro subscribers. Upgrade for the daily email briefing, AI chat, PDF downloads, and full archive."}
      </p>
      <Link
        href="/pricing"
        className="inline-flex items-center rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
      >
        Go Pro — $69/year (save 36%)
      </Link>
      <Link
        href="/pricing"
        className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
      >
        or $9/month
      </Link>
    </div>
  );
}
