import Link from "next/link";
import type { BriefingJSON } from "@/lib/types";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Card, CardContent } from "@/components/ui/card";
import { InstitutionalFlows } from "@/components/briefing/InstitutionalFlows";
import { TechnicalSignals } from "@/components/briefing/TechnicalSignals";
import { NetworkHealth } from "@/components/briefing/NetworkHealth";
import { ExpertExpandable } from "@/components/briefing/ExpertExpandable";
import { ProGate } from "@/components/premium/ProGate";

export function ProTeaser({ briefing }: { briefing: BriefingJSON }) {
  const hasFlows = briefing.institutional_flows != null;
  const hasSignals = briefing.technical_signals != null;
  const hasNetwork = briefing.network_health != null;
  const hasExperts =
    briefing.expert_insights && briefing.expert_insights.length > 0;

  // Fall back to plain ProGate if we have nothing meaningful to tease
  if (!hasFlows && !hasSignals && !hasNetwork && !hasExperts) {
    return <ProGate />;
  }

  return (
    <div className="mt-10 scroll-mt-16">
      {/* Section header — fully visible */}
      <SectionLabel number="05" title="Deep Dive" className="mb-4" />

      {/* Blurred content preview */}
      <div className="relative overflow-hidden">
        <div
          className="max-h-[420px] select-none overflow-hidden"
          style={{ filter: "blur(5px)" }}
          aria-hidden="true"
        >
          {/* 3-column grid matching the real Deep Dive layout */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Card className="h-full gap-0 py-0 ring-1 ring-[var(--color-border)]">
              <CardContent className="p-4 sm:p-5">
                <InstitutionalFlows flows={briefing.institutional_flows} />
              </CardContent>
            </Card>

            <Card className="h-full gap-0 py-0 ring-1 ring-[var(--color-border)]">
              <CardContent className="p-4 sm:p-5">
                <TechnicalSignals signals={briefing.technical_signals} />
              </CardContent>
            </Card>

            <Card className="h-full gap-0 py-0 ring-1 ring-[var(--color-border)]">
              <CardContent className="p-4 sm:p-5">
                <NetworkHealth network={briefing.network_health} />
              </CardContent>
            </Card>
          </div>

          {/* First expert insight */}
          {hasExperts && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ExpertExpandable insight={briefing.expert_insights[0]} />
            </div>
          )}
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
              expert insights, and what's next for BTC.
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
