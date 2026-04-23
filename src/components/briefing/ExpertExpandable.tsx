"use client";

import type { ExpertInsight } from "@/lib/types";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { truncateWords } from "@/lib/utils";
import { ExpertAvatar } from "@/components/briefing/ExpertAvatar";

export function ExpertExpandable({ insight }: { insight: ExpertInsight }) {
  const excerpt = truncateWords(insight.quote_or_summary, 15);
  const hasMore = excerpt !== insight.quote_or_summary;

  const preview = (
    <div className="flex gap-3">
      <ExpertAvatar name={insight.expert_name} twitterHandle={insight.twitter_handle} photoUrl={insight.photo_url} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-accent)]">
            {insight.expert_name}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {insight.role}
          </span>
        </div>
        <p className="mt-1 text-sm italic leading-relaxed text-[var(--color-text-secondary)]">
          &ldquo;{excerpt}{hasMore ? "..." : ""}&rdquo;
        </p>
      </div>
    </div>
  );

  const sourceLine = (
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
  );

  if (!hasMore) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 sm:p-6 card-interactive">
        {preview}
        {sourceLine}
      </div>
    );
  }

  return (
    <ExpandableCard preview={preview}>
      <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {insight.quote_or_summary}
      </p>
      {sourceLine}
    </ExpandableCard>
  );
}
