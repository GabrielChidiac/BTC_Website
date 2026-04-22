import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { getSubscriberTier } from "@/lib/tier";
import { COOKIE_NAME } from "@/lib/session";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";
import { dedupeBriefingStories } from "@/lib/dedupe-stories";
import { formatDisplayDate } from "@/lib/utils";
import { safeJsonLd } from "@/lib/json-ld";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";

import { DailyDiffBanner } from "@/components/briefing/DailyDiffBanner";
import { MarketSnapshot } from "@/components/briefing/MarketSnapshot";
import { TopStories } from "@/components/briefing/TopStories";
import { InstitutionalFlows } from "@/components/briefing/InstitutionalFlows";
import { MacroContext } from "@/components/briefing/MacroContext";
import { ExpertInsights } from "@/components/briefing/ExpertInsights";
import { Regulatory } from "@/components/briefing/Regulatory";
import { Adoption } from "@/components/briefing/Adoption";
import { TechnicalSignals } from "@/components/briefing/TechnicalSignals";
import { BtcVsEverything } from "@/components/briefing/BtcVsEverything";
import { NetworkHealth } from "@/components/briefing/NetworkHealth";
import { SupplyDynamics } from "@/components/briefing/SupplyDynamics";
import { CountdownEvents } from "@/components/briefing/CountdownEvents";
import { LookingAhead } from "@/components/briefing/LookingAhead";
import { FundingRate } from "@/components/briefing/FundingRate";
import { FearGreed } from "@/components/briefing/FearGreed";
import { CorrelationMatrix } from "@/components/briefing/CorrelationMatrix";
import { BriefEndState } from "@/components/briefing/BriefEndState";
import { EditorsNote } from "@/components/briefing/EditorsNote";
import { EmptySignals } from "@/components/briefing/EmptySignals";
import { ProGateCompact } from "@/components/premium/ProGate";
import { getFoundingMemberStatus } from "@/lib/founding";

export const revalidate = false;

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return { title: "Not Found | BTC Today" };

  const displayDate = formatDisplayDate(date);

  // Fetch briefing for dynamic metadata
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("content")
    .eq("date", date)
    .maybeSingle();

  let title = `Bitcoin Market Analysis | ${displayDate} | BTC Today`;
  let description = `AI-curated Bitcoin market analysis for ${displayDate} with institutional flows, technical signals, and expert insights.`;

  if (data) {
    const briefing: BriefingJSON = (data as DailyBriefingRow).content;
    const market = briefing.market_snapshot;
    const pctSign = market.change_24h_pct >= 0 ? "+" : "";
    const price = `$${market.price_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    const change = `${pctSign}${market.change_24h_pct.toFixed(2)}%`;

    title = `BTC ${price} (${change}) | ${displayDate} | BTC Today`;
    description = briefing.one_line
      ? `${briefing.one_line} BTC ${price} ${change}. AI-curated Bitcoin intelligence for ${displayDate}.`
      : `Bitcoin at ${price} (${change}) on ${displayDate}. Market analysis, institutional flows, technical signals, and expert insights.`;
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "BTC Today",
      url: `https://www.btctoday.co/archive/${date}`,
      publishedTime: `${date}T01:00:00Z`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    alternates: {
      canonical: `/archive/${date}`,
    },
  };
}

export async function generateStaticParams() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("date")
    .order("date", { ascending: false });

  return (data ?? []).map((row: { date: string }) => ({ date: row.date }));
}

export default async function ArchiveDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (!isValidDate(date)) notFound();

  let isLoggedIn = false;
  try {
    const cookieStore = await cookies();
    isLoggedIn = !!cookieStore.get(COOKIE_NAME)?.value;
  } catch { /* no session */ }

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (!data) notFound();

  const briefing: BriefingJSON = dedupeBriefingStories(
    (data as DailyBriefingRow).content
  );

  const { tier } = await getSubscriberTier();
  const isPro = tier === "pro";
  const founding = isPro ? null : await getFoundingMemberStatus();
  const foundingOffer = founding ? { spotsLeft: founding.spotsLeft, limit: founding.limit } : null;
  const now = new Date();
  const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
  const briefingDate = new Date(date + "T00:00:00Z");
  const isOldBriefing = briefingDate < sevenDaysAgo;
  // Tier gating on the archive page — matches the homepage contract:
  //   - canViewAny: show the page's free-tier sections (hero, market, top stories).
  //     Free users get this within the last 7 days; Pro always.
  //   - canViewPro:  show the Pro-only deep sections (Adoption, Regulatory,
  //     Flows, Technical, Network, Funding, F&G, Correlations, Experts,
  //     Supply, Countdown, Outlook). Pro-only, regardless of date.
  //   - Briefings older than 7 days fall back to the full paywall branch below.
  const canViewAny = isPro || !isOldBriefing;
  const canViewPro = isPro;

  const cutoffDate = isPro ? undefined : sevenDaysAgo.toISOString().split("T")[0];

  let prevQuery = supabase
    .from("daily_briefings")
    .select("date")
    .lt("date", date)
    .order("date", { ascending: false })
    .limit(1);

  let nextQuery = supabase
    .from("daily_briefings")
    .select("date")
    .gt("date", date)
    .order("date", { ascending: true })
    .limit(1);

  // Free users can only navigate within the 7-day window
  if (cutoffDate) {
    prevQuery = prevQuery.gte("date", cutoffDate);
  }

  const [{ data: prevRows }, { data: nextRows }] = await Promise.all([
    prevQuery,
    nextQuery,
  ]);

  const prevDate = prevRows?.[0]?.date as string | undefined;
  const nextDate = nextRows?.[0]?.date as string | undefined;

  const baseUrl = "https://www.btctoday.co";
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: briefing.one_line || `Bitcoin Market Analysis | ${formatDisplayDate(date)}`,
    datePublished: `${date}T01:00:00Z`,
    dateModified: (data as DailyBriefingRow).updated_at || `${date}T01:00:00Z`,
    author: { "@type": "Organization", name: "BTC Today", url: baseUrl },
    publisher: {
      "@type": "Organization",
      name: "BTC Today",
      url: baseUrl,
      logo: { "@type": "ImageObject", url: `${baseUrl}/logo.png` },
    },
    image: `${baseUrl}/archive/${date}/opengraph-image`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${baseUrl}/archive/${date}` },
    description: `BTC $${briefing.market_snapshot.price_usd.toLocaleString()} | ${briefing.market_snapshot.change_24h_pct >= 0 ? "+" : ""}${briefing.market_snapshot.change_24h_pct.toFixed(2)}% 24h | AI-curated Bitcoin intelligence for ${formatDisplayDate(date)}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "BTC Today", item: baseUrl },
              { "@type": "ListItem", position: 2, name: "Archive", item: `${baseUrl}/archive` },
              { "@type": "ListItem", position: 3, name: formatDisplayDate(date), item: `${baseUrl}/archive/${date}` },
            ],
          }),
        }}
      />
      <Header date={briefing.date} />
      <main className="pb-10">
        <Container>
          <nav className="mt-6 flex items-center justify-between">
            <Link
              href="/archive"
              className="group flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform group-hover:-translate-x-0.5"
              >
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Archive
            </Link>

            <div className="flex items-center gap-3">
              {prevDate ? (
                <Link
                  href={`/archive/${prevDate}`}
                  className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                  title={formatDisplayDate(prevDate)}
                >
                  Prev
                </Link>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]/40">
                  Prev
                </span>
              )}
              <span className="text-xs text-[var(--color-border)]">/</span>
              {nextDate ? (
                <Link
                  href={`/archive/${nextDate}`}
                  className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                  title={formatDisplayDate(nextDate)}
                >
                  Next
                </Link>
              ) : (
                <span className="text-xs text-[var(--color-text-muted)]/40">
                  Next
                </span>
              )}
            </div>
          </nav>

          {canViewAny ? (
            <>
              <DailyDiffBanner dailyDiff={briefing.daily_diff} />
              <MarketSnapshot market={briefing.market_snapshot} />

              {/* Free-tier sections: hero, macro, BTC vs, top stories */}
              <MacroContext macro={briefing.macro_context} />
              <BtcVsEverything comparisons={briefing.btc_vs_everything} />
              <TopStories stories={briefing.top_stories} />

              {!isLoggedIn && (
                <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Create a free account to access market data
                  </p>
                  <SubscribeForm />
                </div>
              )}

              {/* Pro-only deep sections. Free users within the 7-day window see
                  a single ProGateCompact in place of this whole block, matching
                  the homepage's tier contract. */}
              {canViewPro ? (
                <>
                  {briefing.adoption.length > 0 || briefing.regulatory.length > 0 ? (
                    <>
                      <Adoption updates={briefing.adoption} />
                      <Regulatory updates={briefing.regulatory} />
                    </>
                  ) : (
                    <div className="mt-10"><EmptySignals /></div>
                  )}
                  <InstitutionalFlows flows={briefing.institutional_flows} />
                  <div className="mt-10"><TechnicalSignals signals={briefing.technical_signals} /></div>
                  <div className="mt-10"><NetworkHealth network={briefing.network_health} /></div>
                  {briefing.funding_rate && <div className="mt-10"><FundingRate fundingRate={briefing.funding_rate} /></div>}
                  {briefing.fear_greed && <div className="mt-10"><FearGreed fearGreed={briefing.fear_greed} /></div>}
                  {briefing.correlation_matrix && <div className="mt-10"><CorrelationMatrix correlation={briefing.correlation_matrix} /></div>}
                  <ExpertInsights insights={briefing.expert_insights} />
                  <SupplyDynamics supply={briefing.supply_dynamics} />
                  <CountdownEvents events={briefing.countdown_events} />
                  <LookingAhead content={briefing.looking_ahead} />
                </>
              ) : (
                <div className="mt-10">
                  <ProGateCompact
                    message="Deep-dive sections (Adoption, Regulatory, Flows, Technical, Expert Voices, Supply, Outlook) are included with Pro."
                    foundingOffer={foundingOffer}
                  />
                </div>
              )}

              {briefing.fallback_used && <EditorsNote />}

              <BriefEndState
                shareText={briefing.hero_three_lines?.move ?? briefing.one_line ?? `Bitcoin brief for ${formatDisplayDate(date)}`}
                shareUrl={`https://btctoday.co/archive/${date}`}
              />
            </>
          ) : (
            <>
              <DailyDiffBanner dailyDiff={briefing.daily_diff} />
              <MarketSnapshot market={briefing.market_snapshot} />
              <div className="mt-10">
                <ProGateCompact message="Full briefing content for older dates is available to Pro subscribers. Upgrade for the daily email, PDF downloads, and full archive." foundingOffer={foundingOffer} />
              </div>
            </>
          )}

          <nav className="mt-10 flex items-center justify-between border-t border-[var(--color-border)] pt-6">
            {prevDate ? (
              <Link
                href={`/archive/${prevDate}`}
                className="group flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform group-hover:-translate-x-0.5"
                >
                  <path
                    d="M10 12L6 8L10 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {formatDisplayDate(prevDate)}
              </Link>
            ) : (
              <span />
            )}
            {nextDate ? (
              <Link
                href={`/archive/${nextDate}`}
                className="group flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors"
              >
                {formatDisplayDate(nextDate)}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </Container>
      </main>
      <Footer />
    </>
  );
}
