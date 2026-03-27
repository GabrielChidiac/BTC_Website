"use client";

import type { TopStory } from "@/lib/types";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { Badge } from "@/components/ui/badge";

export function StoryExpandable({
  story,
  defaultOpen = false,
}: {
  story: TopStory;
  defaultOpen?: boolean;
}) {
  return (
    <ExpandableCard
      defaultOpen={defaultOpen}
      preview={
        <div className="flex items-start gap-2.5">
          <Badge variant={story.sentiment as "bullish" | "bearish" | "neutral"}>{story.sentiment}</Badge>
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-heading)] text-sm font-bold leading-snug text-[var(--color-text-primary)]">
              {story.headline}
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {story.source}
            </p>
          </div>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {story.summary}
      </p>

      {story.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {story.tags.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
        </div>
      )}

      {story.url && (
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
        >
          Read full story →
        </a>
      )}
    </ExpandableCard>
  );
}
