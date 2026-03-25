import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";
import { formatDisplayDate, formatUSD, formatPctChange } from "@/lib/utils";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

export const revalidate = 3600;

export const metadata = {
  title: "Archive | BTC Today",
  description: "Browse past daily Bitcoin briefings.",
};

function pctColor(pct: number): string {
  return pct >= 0 ? "text-emerald-700" : "text-red-700";
}

export default async function ArchivePage() {
  const supabase = await createServerClient();
  const { data: rows } = await supabase
    .from("daily_briefings")
    .select("*")
    .order("date", { ascending: false });

  const briefings = (rows as DailyBriefingRow[] | null) ?? [];

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
              {briefings.length} briefing{briefings.length !== 1 ? "s" : ""}
            </p>
          </div>

          {briefings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-16">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No briefings yet. The first one publishes at 6 AM CET.
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
              {/* Table header — hidden on mobile, visible on sm+ */}
              <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4 sm:px-4 sm:pb-3 sm:border-b sm:border-[var(--color-border)]">
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  Date
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] text-right w-28">
                  Price
                </span>
                <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] text-right w-20">
                  24h
                </span>
              </div>

              {/* Briefing rows */}
              <div className="flex flex-col">
                {briefings.map((row) => {
                  const b: BriefingJSON = row.content;
                  return (
                    <Link
                      key={row.date}
                      href={`/archive/${row.date}`}
                      className="group grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] sm:gap-4 items-center rounded-lg px-4 py-4 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-surface)]"
                    >
                      {/* Date */}
                      <div>
                        <time
                          dateTime={row.date}
                          className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors"
                        >
                          {formatDisplayDate(row.date)}
                        </time>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 sm:hidden">
                          {formatUSD(b.market_snapshot.price_usd)}{" "}
                          <span className={pctColor(b.market_snapshot.change_24h_pct)}>
                            {formatPctChange(b.market_snapshot.change_24h_pct)}
                          </span>
                        </p>
                      </div>

                      {/* Price — desktop only */}
                      <span className="hidden sm:block font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--color-text-primary)] text-right w-28">
                        {formatUSD(b.market_snapshot.price_usd)}
                      </span>

                      {/* 24h change — desktop only */}
                      <span
                        className={`hidden sm:block text-sm font-medium text-right w-20 ${pctColor(b.market_snapshot.change_24h_pct)}`}
                      >
                        {formatPctChange(b.market_snapshot.change_24h_pct)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
