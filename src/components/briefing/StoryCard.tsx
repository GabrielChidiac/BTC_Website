import type { TopStory } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

export function StoryCard({ story }: { story: TopStory }) {
  return (
    <article className="card-interactive group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 border-l-[3px] border-l-transparent hover:border-l-[var(--color-accent)]">
      <div className="min-w-0">
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-[family-name:var(--font-heading)] text-base font-bold leading-snug text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 rounded"
        >
          {story.headline}
        </a>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {story.source}
        </p>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {story.summary}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant={story.sentiment as "bullish" | "bearish" | "neutral"}>{story.sentiment}</Badge>
        {story.tags.map((tag) => (
          <Badge key={tag} variant="default">{tag}</Badge>
        ))}
      </div>
    </article>
  );
}
