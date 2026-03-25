import type { RegulatoryUpdate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

function impactColor(impact: RegulatoryUpdate["impact"]): "bullish" | "bearish" | "neutral" {
  if (impact === "positive") return "bullish";
  if (impact === "negative") return "bearish";
  return "neutral";
}

export function Regulatory({
  updates,
}: {
  updates: RegulatoryUpdate[];
}) {
  if (updates.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Regulatory &amp; Legal
      </h2>

      <div className="space-y-3">
        {updates.map((update, i) => (
          <article
            key={i}
            className="card-interactive group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
          >
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge label={update.region} variant="default" />
              <Badge label={update.impact} variant={impactColor(update.impact)} />
            </div>

            {update.url && update.url.length > 30 ? (
              <a
                href={update.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors leading-snug block"
              >
                {update.headline}
              </a>
            ) : (
              <p className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)] leading-snug">
                {update.headline}
              </p>
            )}

            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {update.summary}
            </p>

            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {update.source}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
