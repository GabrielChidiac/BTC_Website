import Link from "next/link";
import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import { getSubscriberTier } from "@/lib/tier";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { ArchiveList, type ArchiveEntry } from "@/components/archive/ArchiveList";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Bitcoin Daily Intelligence Archive | BTC Today",
  description:
    "Browse AI-curated daily Bitcoin briefings with market analysis, institutional flows, technical signals, and expert insights.",
  openGraph: {
    title: "Bitcoin Daily Intelligence Archive | BTC Today",
    description:
      "Browse AI-curated daily Bitcoin briefings with market analysis, institutional flows, technical signals, and expert insights.",
    type: "website",
    siteName: "BTC Today",
  },
  twitter: {
    card: "summary",
    title: "Bitcoin Daily Intelligence Archive | BTC Today",
    description:
      "Browse AI-curated daily Bitcoin briefings with market analysis, institutional flows, technical signals, and expert insights.",
  },
};

export default async function ArchivePage() {
  const { tier } = await getSubscriberTier();
  const isPro = tier === "pro";

  const supabase = await createServerClient();

  let query = supabase
    .from("daily_briefings")
    .select("*")
    .order("date", { ascending: false });

  // Free users only see the last 7 days
  if (!isPro) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    query = query.gte("date", cutoff.toISOString().split("T")[0]);
  }

  const { data: rows } = await query;
  const briefings = (rows as DailyBriefingRow[] | null) ?? [];

  // Serialize briefing data for the client component
  const entries: ArchiveEntry[] = briefings.map((row) => {
    const b: BriefingJSON = row.content;
    return {
      date: row.date,
      price: b.market_snapshot.price_usd,
      change24h: b.market_snapshot.change_24h_pct,
      oneLine: b.one_line ?? null,
      consensusLabel: b.narrative_consensus?.label ?? null,
    };
  });

  return (
    <>
      <Header />
      <main className="pb-10">
        <Container>
          {/* Page title */}
          <div className="mt-8 mb-8">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
              Archive
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {briefings.length} briefing{briefings.length !== 1 ? "s" : ""}{!isPro && " · Last 7 days"}
            </p>
          </div>

          {briefings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-16">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No briefings yet. The first one publishes at 2 AM CET.
              </p>
              <Link
                href="/"
                className="mt-4 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                Back to home
              </Link>
            </div>
          ) : (
            <>
              {!isPro && (
                <div className="mb-6 flex items-center gap-3 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-3">
                  <p className="flex-1 text-sm text-[var(--color-text-secondary)]">
                    Unlock the full archive with Pro
                  </p>
                  <Link
                    href="/pricing"
                    className="shrink-0 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    Go Pro — $59/yr
                  </Link>
                </div>
              )}

              <ArchiveList entries={entries} />
            </>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
