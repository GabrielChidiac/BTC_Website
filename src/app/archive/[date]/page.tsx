import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { getSubscriberTier } from "@/lib/tier";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";
import { formatDisplayDate } from "@/lib/utils";

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
import { ProGateCompact } from "@/components/premium/ProGate";

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

  return {
    title: `${formatDisplayDate(date)} | BTC Today`,
    description: `AI-curated Bitcoin briefing for ${formatDisplayDate(date)}.`,
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

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("*")
    .eq("date", date)
    .single();

  if (!data) notFound();

  const briefing: BriefingJSON = (data as DailyBriefingRow).content;

  const { tier } = await getSubscriberTier();
  const now = new Date();
  const sevenDaysAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7));
  const briefingDate = new Date(date + "T00:00:00Z");
  const isOldBriefing = briefingDate < sevenDaysAgo;
  const canViewFull = tier === "pro" || !isOldBriefing;

  const [{ data: prevRows }, { data: nextRows }] = await Promise.all([
    supabase
      .from("daily_briefings")
      .select("date")
      .lt("date", date)
      .order("date", { ascending: false })
      .limit(1),
    supabase
      .from("daily_briefings")
      .select("date")
      .gt("date", date)
      .order("date", { ascending: true })
      .limit(1),
  ]);

  const prevDate = prevRows?.[0]?.date as string | undefined;
  const nextDate = nextRows?.[0]?.date as string | undefined;

  return (
    <>
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

          <DailyDiffBanner dailyDiff={briefing.daily_diff} />
          <MarketSnapshot market={briefing.market_snapshot} />

          {canViewFull ? (
            <>
              <InstitutionalFlows flows={briefing.institutional_flows} />
              <MacroContext macro={briefing.macro_context} />
              <BtcVsEverything comparisons={briefing.btc_vs_everything} />
              <TopStories stories={briefing.top_stories} />
              <ExpertInsights insights={briefing.expert_insights} />
              <Adoption updates={briefing.adoption} />
              <Regulatory updates={briefing.regulatory} />

              <div className="mt-10 flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Get this briefing in your inbox every morning
                </p>
                <SubscribeForm />
              </div>

              <TechnicalSignals signals={briefing.technical_signals} />
              <NetworkHealth network={briefing.network_health} />
              <SupplyDynamics supply={briefing.supply_dynamics} />
              <CountdownEvents events={briefing.countdown_events} />
              <LookingAhead content={briefing.looking_ahead} />
            </>
          ) : (
            <div className="mt-10">
              <ProGateCompact message="Full briefing content for older dates is available to Pro subscribers. Recent briefings (last 7 days) are free." />
            </div>
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
