import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow, ExpertInsight } from "@/lib/types";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Expert Insights | BTC Today",
  description: "What credible Bitcoin experts and macro analysts are saying, sourced from podcasts, interviews, and newsletters.",
};

export default async function ExpertsPage() {
  const supabase = await createServerClient();

  const { data: latestRow } = await supabase
    .from("daily_briefings")
    .select("*")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const latestBriefing: BriefingJSON | null = latestRow
    ? (latestRow as DailyBriefingRow).content
    : null;

  const todayInsights = latestBriefing?.expert_insights ?? [];

  // Get recent briefings for historical insights
  const { data: recentRows } = await supabase
    .from("daily_briefings")
    .select("date, content")
    .order("date", { ascending: false })
    .range(1, 5);

  const historicalInsights: (ExpertInsight & { briefing_date: string })[] = [];
  if (recentRows) {
    for (const row of recentRows as DailyBriefingRow[]) {
      for (const insight of row.content.expert_insights ?? []) {
        historicalInsights.push({ ...insight, briefing_date: row.date });
      }
    }
  }

  return (
    <>
      <Header />
      <main className="pb-10">
        <Container>
          <div className="mt-8 mb-10">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
              Expert Insights
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-lg">
              What credible analysts, fund managers, and institutional voices are saying about Bitcoin, sourced from podcasts, interviews, and newsletters.
            </p>
          </div>

          {todayInsights.length > 0 && (
            <section className="mb-10">
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
                Latest Insights
              </h2>
              <div className="space-y-3">
                {todayInsights.map((insight, i) => (
                  <article
                    key={i}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5"
                  >
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-accent)]">
                        {insight.expert_name}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {insight.role}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      {insight.quote_or_summary}
                    </p>
                    <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                      {insight.source}
                      {insight.date && ` | ${insight.date}`}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          {historicalInsights.length > 0 && (
            <section>
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
                Recent Expert Commentary
              </h2>
              <div className="space-y-3">
                {historicalInsights.map((insight, i) => (
                  <article
                    key={i}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-[var(--color-accent)]">
                        {insight.expert_name}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {insight.role}
                      </span>
                      <span className="text-xs text-[var(--color-text-muted)]">
                        {insight.briefing_date}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {insight.quote_or_summary}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      {insight.source}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
