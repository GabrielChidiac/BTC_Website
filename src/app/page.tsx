import { createServerClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow, AdoptionUpdate, RegulatoryUpdate } from "@/lib/types";
import { compactNumber } from "@/lib/utils";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { MotionCard } from "@/components/ui/MotionCard";

import { BentoGrid } from "@/components/ui/BentoGrid";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatTile } from "@/components/ui/StatTile";
import { Card, CardContent } from "@/components/ui/card";

import { BitcoinHero } from "@/components/hero/BitcoinHero";
import { DayInBriefExpandable } from "@/components/briefing/DayInBriefExpandable";
import { BtcVsEverythingTabs } from "@/components/briefing/BtcVsEverythingTabs";
import { StoryExpandable } from "@/components/briefing/StoryExpandable";
import { SignalExpandable } from "@/components/briefing/SignalExpandable";
import { ExpertExpandable } from "@/components/briefing/ExpertExpandable";
import { InstitutionalFlows } from "@/components/briefing/InstitutionalFlows";
import { TechnicalSignals } from "@/components/briefing/TechnicalSignals";
import { NetworkHealth } from "@/components/briefing/NetworkHealth";
import { LookingAhead } from "@/components/briefing/LookingAhead";


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
              Your first briefing publishes at 2 AM CET.
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

  // Filter countdown events for reuse
  const filteredEvents = briefing.countdown_events
    ? [...briefing.countdown_events]
        .filter((e) => !/conference|summit|expo|convention|meetup|hackathon/i.test(e.name) && !/conference|summit|expo|convention|meetup|hackathon/i.test(e.description))
        .sort((a, b) => {
          if (a.days_away === null && b.days_away === null) return 0;
          if (a.days_away === null) return 1;
          if (b.days_away === null) return -1;
          return a.days_away - b.days_away;
        })
        .slice(0, 5)
    : [];

  const hasLookingAhead = briefing.looking_ahead && briefing.looking_ahead !== "Forward-looking analysis unavailable today.";

  return (
    <>
      <Header date={briefing.date} />
      <main className="relative pb-10">
        <Container wide>

          {/* ═══════════════════════════════════════════════════════════════
              THE ONE LINE — The day's most important conclusion
             ═══════════════════════════════════════════════════════════════ */}
          {briefing.one_line && (
            <div className="mt-6 border-l-[3px] border-[var(--color-accent)] pl-4 py-1">
              <p className="font-[family-name:var(--font-heading)] text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-snug">
                {briefing.one_line}
              </p>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              TIER 1: THE SNAPSHOT
              01 — TODAY'S INSIGHT: Hero + Sentiment Gauge
             ═══════════════════════════════════════════════════════════════ */}
          <div id="insight" className={`scroll-mt-16 ${briefing.one_line ? "mt-6" : "mt-6"}`}>
            <SectionLabel number="01" title="Today&rsquo;s Insight" className="mb-4" />
            <BitcoinHero
              market={market}
              dailyDiff={briefing.daily_diff}
              consensus={briefing.narrative_consensus}
            />
          </div>

          {/* ─── Tier divider: Snapshot → Briefing ─── */}
          <div className="section-divider" />

          {/* ═══════════════════════════════════════════════════════════════
              TIER 2: THE BRIEFING
              02 — MARKET EVIDENCE: Stat tiles
             ═══════════════════════════════════════════════════════════════ */}
          <div id="market" className="mt-10 scroll-mt-16">
            <SectionLabel number="02" title="Market Evidence" className="mb-4" />
            <ScrollReveal>
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
            </ScrollReveal>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              03 — WHAT HAPPENED: Day in Brief + BTC vs Everything + Signals
             ═══════════════════════════════════════════════════════════════ */}
          <div id="news" className="mt-10 scroll-mt-16">
            <SectionLabel number="03" title="What Happened" className="mb-4" />
            <ScrollReveal>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <DayInBriefExpandable
                    macro={briefing.macro_context}
                    events={briefing.countdown_events}
                  />
                </div>
                <div className="lg:col-span-2">
                  <BtcVsEverythingTabs comparisons={briefing.btc_vs_everything} />
                </div>
              </div>
            </ScrollReveal>

            {/* Signals (regulatory + adoption) merged into What Happened */}
            {signals.length > 0 && (
              <ScrollReveal>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {signals.slice(0, 4).map((item, i) => (
                    <SignalExpandable key={i} item={item} />
                  ))}
                </div>
              </ScrollReveal>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              04 — TOP STORIES: Expandable cards
             ═══════════════════════════════════════════════════════════════ */}
          {briefing.top_stories.length > 0 && (
            <div id="stories" className="mt-10 scroll-mt-16">
              <SectionLabel number="04" title="Top Stories" className="mb-4" />
              <ScrollReveal variant="left">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {briefing.top_stories.slice(0, 4).map((story, i) => (
                    <StoryExpandable
                      key={story.url || i}
                      story={story}
                      defaultOpen={i === 0}
                    />
                  ))}
                </div>
              </ScrollReveal>
            </div>
          )}

          {/* ─── Tier divider: Briefing → Deep Dive ─── */}
          <div className="section-divider" />

          {/* ═══════════════════════════════════════════════════════════════
              TIER 3: THE DEEP DIVE
              05 — DEEP DIVE: Data sections + Expert Insights
             ═══════════════════════════════════════════════════════════════ */}
          <div id="deep-dive" className="mt-10 scroll-mt-16">
            <SectionLabel number="05" title="Deep Dive" className="mb-4" />
            <ScrollReveal>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <MotionCard>
                  <Card className="gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
                    <CardContent className="p-4 sm:p-5">
                      <InstitutionalFlows flows={briefing.institutional_flows} />
                    </CardContent>
                  </Card>
                </MotionCard>

                <MotionCard>
                  <Card className="gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
                    <CardContent className="p-4 sm:p-5">
                      <TechnicalSignals signals={briefing.technical_signals} />
                    </CardContent>
                  </Card>
                </MotionCard>

                <MotionCard>
                  <Card className="gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
                    <CardContent className="p-4 sm:p-5">
                      <NetworkHealth network={briefing.network_health} />
                    </CardContent>
                  </Card>
                </MotionCard>
              </div>
            </ScrollReveal>

            {/* Expert Insights — max 3 quotes */}
            {briefing.expert_insights && briefing.expert_insights.length > 0 && (
              <ScrollReveal>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {briefing.expert_insights.slice(0, 3).map((insight, i) => (
                    <ExpertExpandable key={i} insight={insight} />
                  ))}
                </div>
              </ScrollReveal>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              06 — LOOKING AHEAD: Forward outlook + Countdown Events
             ═══════════════════════════════════════════════════════════════ */}
          {(hasLookingAhead || filteredEvents.length > 0) && (
            <div id="outlook" className="mt-10 scroll-mt-16">
              <SectionLabel number="06" title="Looking Ahead" className="mb-4" />

              {hasLookingAhead && (
                <ScrollReveal>
                  <LookingAhead content={briefing.looking_ahead} />
                </ScrollReveal>
              )}

              {filteredEvents.length > 0 && (
                <ScrollReveal variant="scale">
                  <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 ${hasLookingAhead ? "mt-4" : ""}`}>
                    {filteredEvents.map((event) => (
                      <MotionCard key={event.name} lift={4} className="h-full">
                        <Card
                          className={`h-full gap-0 py-0 ring-foreground/0 ${
                            event.days_away !== null && event.days_away <= 3
                              ? "ring-1 ring-[var(--color-accent)]/30 glow-card"
                              : "ring-1 ring-[var(--color-border)]"
                          }`}
                        >
                          <CardContent className="p-4">
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
                          </CardContent>
                        </Card>
                      </MotionCard>
                    ))}
                  </div>
                </ScrollReveal>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              YOU'RE CAUGHT UP — Completion marker
             ═══════════════════════════════════════════════════════════════ */}
          <div className="mt-10 flex flex-col items-center gap-1">
            <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]">
              You&rsquo;re caught up
            </p>
            <p className="text-xs text-[var(--color-accent)]/70">
              Next briefing: 2 AM CET tomorrow
            </p>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SUBSCRIBE CTA
             ═══════════════════════════════════════════════════════════════ */}
          <ScrollReveal variant="scale">
            <div className="shimmer-border mt-8 rounded-xl">
              <Card className="gap-0 py-0 ring-0">
                <CardContent className="flex flex-col items-center gap-3 p-8">
                  <p className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)]">
                    Get the daily briefing in your inbox
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Every morning at 2 AM CET
                  </p>
                  <SubscribeForm />
                </CardContent>
              </Card>
            </div>
          </ScrollReveal>

        </Container>
      </main>
      <Footer />
    </>
  );
}
