import type { Metadata } from "next";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { getSubscriberTier } from "@/lib/tier";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";
import { compactNumber } from "@/lib/utils";
import { BLOCKED_EVENT_KEYWORDS } from "@/lib/constants";

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
import { ExpertExpandable } from "@/components/briefing/ExpertExpandable";
import { Adoption } from "@/components/briefing/Adoption";
import { Regulatory } from "@/components/briefing/Regulatory";
import { InstitutionalFlows } from "@/components/briefing/InstitutionalFlows";
import { TechnicalSignals } from "@/components/briefing/TechnicalSignals";
import { NetworkHealth } from "@/components/briefing/NetworkHealth";
import { LookingAhead } from "@/components/briefing/LookingAhead";
import { NextBriefingCountdown } from "@/components/briefing/NextBriefingCountdown";
import { BriefingTabs } from "@/components/briefing/BriefingTabs";
import { getFoundingMemberStatus } from "@/lib/founding";


export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("content")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return {
      title: "BTC Today | AI-Curated Bitcoin Intelligence",
      description:
        "Daily AI-curated Bitcoin intelligence for investors: market data, institutional flows, macro analysis, and expert insights.",
      alternates: { canonical: "/" },
    };
  }

  const briefing: BriefingJSON = (data as DailyBriefingRow).content;
  const market = briefing.market_snapshot;
  const pctSign = market.change_24h_pct >= 0 ? "+" : "";
  const price = `$${market.price_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  const change = `${pctSign}${market.change_24h_pct.toFixed(2)}%`;

  const title = `BTC ${price} (${change}) | BTC Today`;
  const description = briefing.one_line
    ? `${briefing.one_line} BTC ${price} ${change} 24h. AI-curated Bitcoin intelligence for investors.`
    : `Bitcoin at ${price} (${change} 24h). Daily AI-curated market analysis, institutional flows, and expert insights.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "BTC Today",
      url: "https://www.btctoday.co",
      publishedTime: `${briefing.date}T01:00:00Z`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: { canonical: "/" },
  };
}

function formatFlowUSD(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? "+" : "-";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

export default async function Home() {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

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
              Create a free account to start reading.
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
  let { tier, email: sessionEmail } = await getSubscriberTier();
  const isLoggedIn = !!sessionEmail;

  // Auto-upgrade logged-in free-tier users when the founding offer is active
  if (isLoggedIn && tier === "free") {
    const f = await getFoundingMemberStatus();
    if (f.isOfferActive) {
      const svc = createServiceClient();
      await svc
        .from("subscribers")
        .update({ tier: "pro", is_founding_member: true, tier_updated_at: new Date().toISOString() })
        .eq("email", sessionEmail);
      tier = "pro";
    }
  }

  const isPro = tier === "pro";
  const founding = isPro ? null : await getFoundingMemberStatus();

  // Filter countdown events for reuse
  const filteredEvents = briefing.countdown_events
    ? [...briefing.countdown_events]
        .filter((e) => !BLOCKED_EVENT_KEYWORDS.test(e.name) && !BLOCKED_EVENT_KEYWORDS.test(e.description))
        .sort((a, b) => {
          if (a.days_away === null && b.days_away === null) return 0;
          if (a.days_away === null) return 1;
          if (b.days_away === null) return -1;
          return a.days_away - b.days_away;
        })
        .slice(0, 5)
    : [];

  const hasLookingAhead = briefing.looking_ahead && briefing.looking_ahead !== "Forward-looking analysis unavailable today.";

  const baseUrl = "https://www.btctoday.co";
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: briefing.one_line || `Bitcoin Market Analysis | ${briefing.date}`,
    datePublished: `${briefing.date}T01:00:00Z`,
    dateModified: (data as DailyBriefingRow).updated_at || `${briefing.date}T01:00:00Z`,
    author: { "@type": "Organization", name: "BTC Today", url: baseUrl },
    publisher: {
      "@type": "Organization",
      name: "BTC Today",
      url: baseUrl,
      logo: { "@type": "ImageObject", url: `${baseUrl}/logo.png` },
    },
    image: `${baseUrl}/opengraph-image`,
    mainEntityOfPage: { "@type": "WebPage", "@id": baseUrl },
    description: `BTC $${market.price_usd.toLocaleString()} | ${market.change_24h_pct >= 0 ? "+" : ""}${market.change_24h_pct.toFixed(2)}% 24h | AI-curated Bitcoin intelligence`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <Header date={briefing.date} />
      <main className="relative pb-10">
        <Container wide>

          {/* ═══════════════════════════════════════════════════════════════
              THE ONE LINE — The day's most important conclusion
             ═══════════════════════════════════════════════════════════════ */}
          {briefing.one_line && (
            <div className="mt-6">
              <div className="border-l-[3px] border-[var(--color-accent)] pl-4 py-1">
                <p className="font-[family-name:var(--font-heading)] text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-snug">
                  {briefing.one_line}
                </p>
              </div>
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

          {/* Breathing room between hero and tabs */}
          <div className="mt-10" />

          {/* ═══════════════════════════════════════════════════════════════
              BRIEFING TABS — Two-page book layout
             ═══════════════════════════════════════════════════════════════ */}
          <BriefingTabs
            isPro={isPro}
            foundingOffer={founding ? { spotsLeft: founding.spotsLeft, limit: founding.limit } : null}
            tab1Content={
              <>
                {/* 02 — MARKET EVIDENCE */}
                <div id="market" className="mt-8 scroll-mt-28">
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
                      {isPro && (() => {
                        const flow = briefing.etf_flows?.daily_net_flow_usd ?? null;
                        if (flow == null) return null;
                        return (
                          <StatTile
                            label="Daily ETF Flow"
                            value={formatFlowUSD(flow)}
                            delta={briefing.etf_flows?.mtd_net_flow_usd != null
                              ? { value: `MTD: ${formatFlowUSD(briefing.etf_flows.mtd_net_flow_usd)}`, positive: briefing.etf_flows.mtd_net_flow_usd >= 0 }
                              : undefined}
                            size="sm"
                          />
                        );
                      })()}
                      {isPro && (() => {
                        const aum = briefing.etf_flows?.total_net_assets_usd ?? null;
                        if (aum == null) return null;
                        return (
                          <StatTile
                            label="Total ETF AUM"
                            value={`$${compactNumber(aum)}`}
                            size="sm"
                          />
                        );
                      })()}
                    </BentoGrid>
                  </ScrollReveal>
                </div>

                {/* 03 — WHAT HAPPENED */}
                <div id="news" className="mt-10 scroll-mt-28">
                  <SectionLabel number="03" title="What Happened" className="mb-4" />
                  <ScrollReveal>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                      <div className="lg:col-span-3">
                        <DayInBriefExpandable
                          macro={briefing.macro_context}
                          events={isPro ? briefing.countdown_events : undefined}
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <BtcVsEverythingTabs comparisons={briefing.btc_vs_everything} />
                      </div>
                    </div>
                  </ScrollReveal>
                </div>

                {/* 04 — TOP STORIES */}
                {briefing.top_stories.length > 0 && (
                  <div id="stories" className="mt-10 scroll-mt-28">
                    <SectionLabel number="04" title="Top Stories" className="mb-4" />
                    <ScrollReveal variant="left">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
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
              </>
            }
            tab2Content={
              <>
                {/* 05 — ADOPTION & REGULATORY */}
                {(briefing.adoption.length > 0 || briefing.regulatory.length > 0) && (
                  <div id="signals" className="mt-8 scroll-mt-28">
                    <SectionLabel number="05" title="Adoption &amp; Regulatory" className="mb-4" />
                    <ScrollReveal>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
                        {briefing.adoption.length > 0 && <Adoption updates={briefing.adoption} />}
                        {briefing.regulatory.length > 0 && <Regulatory updates={briefing.regulatory} />}
                      </div>
                    </ScrollReveal>
                  </div>
                )}

                {/* 06 — DEEP DIVE */}
                <div id="deep-dive" className="mt-10 scroll-mt-28">
                  <SectionLabel number="06" title="Deep Dive" className="mb-4" />
                  <ScrollReveal>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 items-start">
                      <MotionCard>
                        <Card className="card-interactive gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
                          <CardContent className="p-4 sm:p-5">
                            <InstitutionalFlows flows={briefing.institutional_flows} />
                          </CardContent>
                        </Card>
                      </MotionCard>

                      <MotionCard>
                        <Card className="card-interactive gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
                          <CardContent className="p-4 sm:p-5">
                            <TechnicalSignals signals={briefing.technical_signals} />
                          </CardContent>
                        </Card>
                      </MotionCard>

                      <MotionCard>
                        <Card className="card-interactive gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
                          <CardContent className="p-4 sm:p-5">
                            <NetworkHealth network={briefing.network_health} />
                          </CardContent>
                        </Card>
                      </MotionCard>
                    </div>
                  </ScrollReveal>

                  {briefing.expert_insights && briefing.expert_insights.length > 0 && (
                    <ScrollReveal>
                      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 items-start">
                        {briefing.expert_insights.slice(0, 3).map((insight, i) => (
                          <ExpertExpandable key={i} insight={insight} />
                        ))}
                      </div>
                    </ScrollReveal>
                  )}
                </div>

                {/* 07 — LOOKING AHEAD */}
                {(hasLookingAhead || filteredEvents.length > 0) && (
                  <div id="outlook" className="mt-10 scroll-mt-28">
                    <SectionLabel number="07" title="Looking Ahead" className="mb-4" />

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
                                className={`card-interactive h-full gap-0 py-0 ring-1 ${
                                  event.days_away !== null && event.days_away <= 3
                                    ? "ring-[var(--color-accent)]/30 glow-card"
                                    : "ring-[var(--color-border)]"
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
              </>
            }
          />

          {/* ═══════════════════════════════════════════════════════════════
              YOU'RE CAUGHT UP — Completion marker
             ═══════════════════════════════════════════════════════════════ */}
          <div className="mt-10 flex flex-col items-center gap-1">
            <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-accent)]">
              You&rsquo;re caught up
            </p>
            <NextBriefingCountdown />
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              SUBSCRIBE CTA
             ═══════════════════════════════════════════════════════════════ */}
          {!isLoggedIn && (
            <ScrollReveal variant="scale">
              <div className="shimmer-border mt-8 rounded-xl">
                <Card className="gap-0 py-0 ring-0">
                  <CardContent className="flex flex-col items-center gap-3 p-8">
                    <p className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)]">
                      Never miss a week in Bitcoin
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Free weekly recap of what you missed: market data, top stories & key signals
                    </p>
                    <SubscribeForm />
                  </CardContent>
                </Card>
              </div>
            </ScrollReveal>
          )}

        </Container>
      </main>
      <Footer />
    </>
  );
}
