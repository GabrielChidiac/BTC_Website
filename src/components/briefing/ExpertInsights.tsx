import type { ExpertInsight } from "@/lib/types";
import { ExpertAvatar } from "@/components/briefing/ExpertAvatar";

export function ExpertInsights({
  insights,
}: {
  insights: ExpertInsight[];
}) {
  const hasInsights = insights && insights.length > 0;

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-1">
        Expert Insights
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        What credible voices are saying, with a link to the primary source
      </p>

      {hasInsights ? (
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5"
            >
              <div className="flex gap-3">
                <ExpertAvatar name={insight.expert_name} twitterHandle={insight.twitter_handle} photoUrl={insight.photo_url} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
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
                    {insight.source_url ? (
                      <a
                        href={insight.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-[var(--color-accent)] hover:underline"
                      >
                        {insight.source}
                      </a>
                    ) : (
                      insight.source
                    )}
                    {insight.date && ` | ${insight.date}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No verified expert commentary this cycle.
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            We only surface commentary we can link to a primary source. Quiet weeks stay quiet here.
          </p>
        </div>
      )}
    </section>
  );
}
