import { createServerClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { SubscribeForm } from "@/components/subscribe/SubscribeForm";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";

import { BitcoinHero } from "@/components/hero/BitcoinHero";
import { CountdownEvents } from "@/components/briefing/CountdownEvents";
import { InstitutionalFlows } from "@/components/briefing/InstitutionalFlows";
import { BtcVsEverything } from "@/components/briefing/BtcVsEverything";
import { TopStories } from "@/components/briefing/TopStories";
import { Adoption } from "@/components/briefing/Adoption";
import { Regulatory } from "@/components/briefing/Regulatory";
import { MacroContext } from "@/components/briefing/MacroContext";
import { LookingAhead } from "@/components/briefing/LookingAhead";

export const revalidate = 3600;

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

  return (
    <>
      <Header date={briefing.date} />
      <main className="relative pb-10">
        <Container>
          <BitcoinHero market={briefing.market_snapshot} dailyDiff={briefing.daily_diff} />

          <CountdownEvents events={briefing.countdown_events} compact />

          <RevealOnScroll variant="scale">
            <MacroContext macro={briefing.macro_context} />
          </RevealOnScroll>

          <RevealOnScroll delay={50}>
            <LookingAhead content={briefing.looking_ahead} />
          </RevealOnScroll>

          <div className="section-divider" />

          <RevealOnScroll variant="left">
            <InstitutionalFlows flows={briefing.institutional_flows} />
          </RevealOnScroll>

          <RevealOnScroll delay={50} variant="scale">
            <BtcVsEverything comparisons={briefing.btc_vs_everything} />
          </RevealOnScroll>

          <div className="section-divider" />

          <RevealOnScroll variant="left">
            <TopStories stories={briefing.top_stories} />
          </RevealOnScroll>

          {/* Mid-page subscribe CTA */}
          <RevealOnScroll delay={50}>
            <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-bg-surface)] px-5 py-3">
              <p className="text-sm text-[var(--color-text-secondary)] sm:flex-1">
                Get this briefing in your inbox, every morning
              </p>
              <SubscribeForm />
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={50}>
            <Adoption updates={briefing.adoption} />
          </RevealOnScroll>

          <RevealOnScroll delay={50} variant="left">
            <Regulatory updates={briefing.regulatory} />
          </RevealOnScroll>

          <div className="section-divider" />

          {/* Subscribe CTA — shimmer border */}
          <RevealOnScroll variant="scale">
            <div className="shimmer-border mt-10 rounded-xl">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--color-bg-surface)] p-6">
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
