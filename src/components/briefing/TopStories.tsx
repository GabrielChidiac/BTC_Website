import type { TopStory, TopStoryCategory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const CATEGORY_LABELS: Record<TopStoryCategory, string> = {
  market: "Market",
  regulatory: "Regulatory",
  adoption: "Adoption",
  macro: "Macro",
  technical: "Technical",
};

export function TopStories({ stories }: { stories: TopStory[] }) {
  if (!stories || stories.length === 0) return null;

  const [featured, ...rest] = stories;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-accent)]/30 to-transparent" />
        <h2 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-accent)]">
          Top Stories
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-[var(--color-accent)]/30 to-transparent" />
      </div>

      {/* Featured story — large card */}
      <article className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 sm:p-6 mb-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {featured.category && (
            <Badge variant="default">{CATEGORY_LABELS[featured.category]}</Badge>
          )}
          <Badge variant={featured.sentiment as "bullish" | "bearish" | "neutral"}>{featured.sentiment}</Badge>
          <span className="text-xs text-[var(--color-text-muted)]">
            {featured.source}
          </span>
        </div>

        <a
          href={featured.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-[family-name:var(--font-heading)] text-lg sm:text-xl font-bold leading-snug text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 rounded block"
        >
          {featured.headline}
        </a>

        <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {featured.summary}
        </p>

        {featured.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {featured.tags.map((tag) => (
              <Badge key={tag} variant="default">{tag}</Badge>
            ))}
          </div>
        )}
      </article>

      {/* Remaining stories — compact rows */}
      {rest.length > 0 && (
        <div className="card-interactive space-y-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
          {rest.map((story, i) => (
            <article
              key={story.url}
              className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-bg-elevated)]/60 ${
                i > 0 ? "border-t border-[var(--color-border)]/50" : ""
              }`}
            >
              <div className="flex flex-col gap-1 shrink-0">
                {story.category && (
                  <Badge variant="default">{CATEGORY_LABELS[story.category]}</Badge>
                )}
                <Badge variant={story.sentiment as "bullish" | "bearish" | "neutral"}>{story.sentiment}</Badge>
              </div>

              <div className="min-w-0 flex-1">
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors leading-snug focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 rounded"
                >
                  {story.headline}
                </a>
                <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                  {story.source}
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
