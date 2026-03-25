import type { ExpertInsight } from "@/lib/types";

export function ExpertInsights({
  insights,
}: {
  insights: ExpertInsight[];
}) {
  if (!insights || insights.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-1">
        Expert Insights
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        What credible voices are saying
      </p>

      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div
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
          </div>
        ))}
      </div>
    </section>
  );
}
