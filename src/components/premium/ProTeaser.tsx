import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Card, CardContent } from "@/components/ui/card";

function SkeletonCard({ lines = 4 }: { lines?: number }) {
  return (
    <Card className="h-full gap-0 py-0 ring-1 ring-[var(--color-border)]">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="h-3 w-24 rounded bg-[var(--color-border)]/60" />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className="h-2.5 rounded bg-[var(--color-border)]/40"
              style={{ width: `${75 + Math.sin(i * 2) * 20}%` }}
            />
          ))}
        </div>
        <div className="h-6 w-16 rounded bg-[var(--color-border)]/30" />
      </CardContent>
    </Card>
  );
}

export function ProTeaser() {
  return (
    <div className="mt-10 scroll-mt-16">
      {/* Section header — fully visible */}
      <SectionLabel number="05" title="Deep Dive" className="mb-4" />

      {/* Skeleton content preview */}
      <div className="relative overflow-hidden">
        <div
          className="max-h-[420px] select-none overflow-hidden"
          style={{ filter: "blur(5px)" }}
          aria-hidden="true"
        >
          {/* 3-column grid matching the real Deep Dive layout */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={4} />
            <SkeletonCard lines={6} />
          </div>

          {/* Expert row skeleton */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card className="gap-0 py-0 ring-1 ring-[var(--color-border)]">
              <CardContent className="flex items-start gap-3 p-4">
                <div className="h-10 w-10 shrink-0 rounded-full bg-[var(--color-border)]/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-20 rounded bg-[var(--color-border)]/60" />
                  <div className="h-2.5 w-full rounded bg-[var(--color-border)]/40" />
                  <div className="h-2.5 w-3/4 rounded bg-[var(--color-border)]/40" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Gradient fade overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-[var(--color-bg-base)]/70 to-[var(--color-bg-base)]" />

        {/* CTA overlay */}
        <div className="absolute inset-x-0 bottom-0 flex justify-center pb-4 pt-16">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-bg-surface)]/95 px-8 py-6 text-center shadow-lg shadow-black/5 backdrop-blur-sm">
            <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]">
              Pro
            </p>
            <p className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
              Unlock the full briefing
            </p>
            <p className="max-w-xs text-sm text-[var(--color-text-secondary)] leading-relaxed">
              Daily email briefing, institutional flows, technical signals,
              expert insights, and what&rsquo;s next for BTC.
            </p>
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
        </div>
      </div>
    </div>
  );
}
