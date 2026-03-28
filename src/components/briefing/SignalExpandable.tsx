"use client";

import type { AdoptionUpdate, RegulatoryUpdate } from "@/lib/types";
import { ExpandableCard } from "@/components/ui/ExpandableCard";
import { Badge } from "@/components/ui/badge";

type SignalItem =
  | { type: "adoption"; data: AdoptionUpdate }
  | { type: "regulatory"; data: RegulatoryUpdate };

function impactVariant(impact: RegulatoryUpdate["impact"]): "bullish" | "bearish" | "neutral" {
  if (impact === "positive") return "bullish";
  if (impact === "negative") return "bearish";
  return "neutral";
}

const categoryLabels: Record<AdoptionUpdate["category"], string> = {
  corporate: "Corporate",
  institutional: "Institutional",
  merchant: "Merchant",
  country: "Country",
  infrastructure: "Infrastructure",
};

export function SignalExpandable({ item }: { item: SignalItem }) {
  const preview = (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        {item.type === "regulatory" ? (
          <>
            <Badge variant="default">Regulatory</Badge>
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
      <p className="font-[family-name:var(--font-heading)] text-sm font-bold leading-snug text-[var(--color-text-primary)]">
        {item.data.headline}
      </p>
    </div>
  );

  return (
    <ExpandableCard preview={preview} className="h-full">
      <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
        {item.data.summary}
      </p>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        {item.data.source}
      </p>
      {item.data.url && item.data.url.length > 10 && (
        <a
          href={item.data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
        >
          Source →
        </a>
      )}
    </ExpandableCard>
  );
}
