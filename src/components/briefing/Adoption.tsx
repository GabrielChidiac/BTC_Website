import type { AdoptionUpdate } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

const categoryLabels: Record<AdoptionUpdate["category"], string> = {
  corporate: "Corporate",
  institutional: "Institutional",
  merchant: "Merchant",
  country: "Country",
  infrastructure: "Infrastructure",
};

export function Adoption({
  updates,
}: {
  updates: AdoptionUpdate[];
}) {
  if (updates.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Adoption Tracker
      </h2>

      <div className="space-y-3">
        {updates.map((update, i) => (
          <article
            key={i}
            className="card-interactive group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
          >
            <div className="mb-2">
              <Badge label={categoryLabels[update.category]} variant="default" />
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
