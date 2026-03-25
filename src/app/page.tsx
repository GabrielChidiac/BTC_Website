import { createServerClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow, AdoptionUpdate, RegulatoryUpdate } from "@/lib/types";
import { compactNumber } from "@/lib/utils";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

import { BentoGrid } from "@/components/ui/BentoGrid";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatTile } from "@/components/ui/StatTile";

import { BitcoinHero } from "@/components/hero/BitcoinHero";
import { DayInBriefExpandable } from "@/components/briefing/DayInBriefExpandable";
import { BtcVsEverythingTabs } from "@/components/briefing/BtcVsEverythingTabs";
import { StoryExpandable } from "@/components/briefing/StoryExpandable";
import { SignalExpandable } from "@/components/briefing/SignalExpandable";
import { InstitutionalFlows } from "@/components/briefing/InstitutionalFlows";
import { TechnicalSignals } from "@/components/briefing/TechnicalSignals";
import { NetworkHealth } from "@/components/briefing/NetworkHealth";


export const revalidate = 3600;

function formatFlowUSD(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? "+" : "-";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

type SignalItem =
  | { type: "adoption"; data: AdoptionUpdate }
  | { type: "regulatory"; data: RegulatoryUpdate };

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  if (!data) {
    return (
      <>
        <Header />
        <main className="flex min-h-[70vh] flex-col items-center justify-center px-4">
          <div className="max-w-sm text-center">
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">
              BTC{" "}
              <span className="text-[var(--color-accent)]">Today</span>
            </h1>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              Your first briefing publishes at 6 AM CET.
              <br />
              Subscribe to get it in your inbox.
            </p>
            <div className="mt-6 flex justify-center">
              <SubscribeForm />
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const briefing: BriefingJSON = (data as DailyBriefingRow).content;
  const market = briefing.market_snapshot;

  // Build signals list
  const signals: SignalItem[] = [
    ...briefing.regulatory.map((r) => ({ type: "regulatory" as const, data: r })),
    ...briefing.adoption.map((a) => ({ type: "adoption" as const, data: a })),
  ];

  return (
    <>
      <Header date={briefing.date} />
      <main className="relative pb-10">
        <Container wide>

          {/* ═══════════════════════════════════════════════════════════════
              01 — TODAY'S INSIGHT: Hero + Sentiment Gauge
             ═══════════════════════════════════════════════════════════════ */}
          <div className="mt-6">
            <SectionLabel number="01" title="Today&rsquo;s Insight" className="mb-4" />
            <BitcoinHero
              market={market}
              dailyDiff={briefing.daily_diff}
              consensus={briefing.narrative_consensus}
            />
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              02 — MARKET EVIDENCE: Stat tiles
             ═══════════════════════════════════════════════════════════════ */}
          <div className="mt-16">
            <SectionLabel number="02" title="Market Evidence" className="mb-4" />
            <BentoGrid>
              <StatTile
                label="Market Cap"
                value={`$${compactNumber(market.market_cap_usd)}`}
                size="sm"
              />
              <StatTile
                label="24h Volume"
                value={`$${compactNumber(market.volume_24h_usd)}`}
                size="sm"
              />
              <StatTile
                label="Dominance"
                value={`${market.dominance_pct.toFixed(1)}%`}
                size="sm"
              />
              {briefing.institutional_flows?.etf_net_flow_usd != null && (
                <StatTile
                  label="ETF Flow"
                  value={formatFlowUSD(briefing.institutional_flows.etf_net_flow_usd)}
                  delta={{
                    value: briefing.institutional_flows.etf_flow_trend !== "Data unavailable"
                      ? briefing.institutional_flows.etf_flow_trend.slice(0, 40)
                      : "",
                    positive: briefing.institutional_flows.etf_net_flow_usd >= 0,
                  }}
                  size="sm"
                />
              )}
            </BentoGrid>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              03 — WHAT HAPPENED: Day in Brief + BTC vs Everything
             ═══════════════════════════════════════════════════════════════ */}
          <div className="mt-16">
            <SectionLabel number="03" title="What Happened" className="mb-4" />
            <RevealOnScroll>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                {/* Day in Brief — wider, expandable with first 2 bullets visible */}
                <div className="lg:col-span-3">
                  <DayInBriefExpandable
                    macro={briefing.macro_context}
                    lookingAhead={briefing.looking_ahead}
                    events={briefing.countdown_events}
                  />
                </div>

                {/* BTC vs Everything — expandable for more comparisons */}
                <div className="lg:col-span-2">
                  <BtcVsEverythingTabs comparisons={briefing.btc_vs_everything} />
                </div>
              </div>
            </RevealOnScroll>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              04 — TOP STORIES: Expandable cards (text-heavy, benefits from collapse)
             ═══════════════════════════════════════════════════════════════ */}
          {briefing.top_stories.length > 0 && (
            <div className="mt-16">
              <SectionLabel number="04" title="Top Stories" className="mb-4" />
              <RevealOnScroll variant="left">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {briefing.top_stories.map((story, i) => (
                    <StoryExpandable
                      key={story.url || i}
                      story={story}
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              </RevealOnScroll>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              05 — DEEP DIVE: Data sections shown directly (no expand)
             ═══════════════════════════════════════════════════════════════ */}
          <div className="mt-16">
            <SectionLabel number="05" title="Deep Dive" className="mb-4" />
            <RevealOnScroll>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Institutional Flows — shown directly */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5">
                  <InstitutionalFlows flows={briefing.institutional_flows} />
                </div>

                {/* Technical Signals — shown directly */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5">
                  <TechnicalSignals signals={briefing.technical_signals} />
                </div>

                {/* Network Health — shown directly */}
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5">
                  <NetworkHealth network={briefing.network_health} />
                </div>
              </div>
            </RevealOnScroll>

          </div>

          {/* ═══════════════════════════════════════════════════════════════
              06 — SIGNALS: Regulatory + Adoption (expandable, text-heavy)
             ═══════════════════════════════════════════════════════════════ */}
          {signals.length > 0 && (
            <div className="mt-16">
              <SectionLabel number="06" title="Signals" className="mb-4" />
              <RevealOnScroll>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {signals.map((item, i) => (
                    <SignalExpandable key={i} item={item} />
                  ))}
                </div>
              </RevealOnScroll>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              07 — WHAT'S NEXT: Countdown Events
             ═══════════════════════════════════════════════════════════════ */}
          {briefing.countdown_events && briefing.countdown_events.length > 0 && (
            <div className="mt-16">
              <SectionLabel number="07" title="What&rsquo;s Next" className="mb-4" />
              <RevealOnScroll variant="scale">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {briefing.countdown_events.slice(0, 8).map((event) => (
                    <div
                      key={event.name}
                      className={`card-interactive rounded-xl border bg-[var(--color-bg-surface)] p-4 ${
                        event.days_away !== null && event.days_away <= 3
                          ? "border-[var(--color-accent)]/30 glow-card"
                          : "border-[var(--color-border)]"
                      }`}
                    >
                      <p className="font-[family-name:var(--font-heading)] text-2xl font-bold tabular-nums text-[var(--color-text-primary)]">
                        {event.days_away !== null ? `${event.days_away}d` : "TBD"}
                      </p>
                      <p className="mt-1 text-sm font-[family-name:var(--font-heading)] font-semibold text-[var(--color-text-primary)] leading-snug">
                        {event.name}
                      </p>
                      {event.description && (
                        <p className="mt-1 text-xs text-[var(--color-text-muted)] leading-relaxed">
                          {event.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </RevealOnScroll>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              SUBSCRIBE CTA
             ═══════════════════════════════════════════════════════════════ */}
          <RevealOnScroll variant="scale">
            <div className="shimmer-border mt-16 rounded-xl">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--color-bg-surface)] p-8">
                <p className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)]">
                  Get the daily briefing in your inbox
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  AI-curated Bitcoin intelligence for decision-makers, every morning at 6 AM CET
                </p>
                <SubscribeForm />
              </div>
            </div>
          </RevealOnScroll>

        </Container>
      </main>
      <Footer />
    </>
  );
}
