import type { AdoptionUpdate, RegulatoryUpdate } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

type SignalItem =
  | { type: "adoption"; data: AdoptionUpdate }
  | { type: "regulatory"; data: RegulatoryUpdate };

const categoryLabels: Record<AdoptionUpdate["category"], string> = {
  corporate: "Corporate",
  institutional: "Institutional",
  merchant: "Merchant",
  country: "Country",
  infrastructure: "Infrastructure",
};

function impactVariant(impact: RegulatoryUpdate["impact"]): "bullish" | "bearish" | "neutral" {
  if (impact === "positive") return "bullish";
  if (impact === "negative") return "bearish";
  return "neutral";
}

export function Signals({
  adoption,
  regulatory,
}: {
  adoption: AdoptionUpdate[];
  regulatory: RegulatoryUpdate[];
}) {
  /* Interleave: regulatory first (more impactful), then adoption */
  const items: SignalItem[] = [
    ...regulatory.map((r) => ({ type: "regulatory" as const, data: r })),
    ...adoption.map((a) => ({ type: "adoption" as const, data: a })),
  ];

  if (items.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-accent)]/30 to-transparent" />
        <h2 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-accent)]">
          Signals
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-[var(--color-accent)]/30 to-transparent" />
      </div>

      <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
        {items.map((item, i) => (
          <article
            key={i}
            className={`px-4 py-3.5 transition-colors hover:bg-[var(--color-bg-elevated)]/60 ${
              i > 0 ? "border-t border-[var(--color-border)]/50" : ""
            }`}
          >
            {/* Badge row */}
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {item.type === "regulatory" ? (
                <>
                  <Badge variant="default">Regulatory</Badge>
                  <Badge variant="neutral">{(item.data as RegulatoryUpdate).region}</Badge>
                  <Badge
                    variant={impactVariant((item.data as RegulatoryUpdate).impact)}
                  >{(item.data as RegulatoryUpdate).impact}</Badge>
                </>
              ) : (
                <>
                  <Badge variant="default">Adoption</Badge>
                  <Badge
                    variant="neutral"
                  >{categoryLabels[(item.data as AdoptionUpdate).category]}</Badge>
                </>
              )}
            </div>

            {/* Headline */}
            {item.data.url && item.data.url.length > 30 ? (
              <a
                href={item.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors leading-snug block"
              >
                {item.data.headline}
              </a>
            ) : (
              <p className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] leading-snug">
                {item.data.headline}
              </p>
            )}

            {/* Summary */}
            <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
              {item.data.summary}
            </p>

            {/* Source */}
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {item.data.source}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
