import type { FearGreedIndex } from "@/lib/types";

function gaugeColor(value: number): string {
  if (value <= 25) return "#B44A3F";  // brand bearish — Extreme Fear
  if (value <= 45) return "#E8850F";  // brand accent hover — Fear
  if (value <= 55) return "#F7931A";  // brand accent — Neutral
  if (value <= 75) return "#3F8D6F";  // brand bullish (lighter) — Greed
  return "#0F7A5A";                   // brand bullish — Extreme Greed
}

function gaugeTextColor(value: number): string {
  if (value <= 25) return "text-[var(--color-bearish)]";
  if (value <= 45) return "text-[var(--color-accent-hover)]";
  if (value <= 55) return "text-[var(--color-accent)]";
  if (value <= 75) return "text-[var(--color-bullish)]/80";
  return "text-[var(--color-bullish)]";
}

export function FearGreed({
  fearGreed,
}: {
  fearGreed?: FearGreedIndex | null;
}) {
  if (!fearGreed) return null;

  const { value, label } = fearGreed;
  const color = gaugeColor(value);
  const textColor = gaugeTextColor(value);

  return (
    <section>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-3">
        Fear &amp; Greed Index
      </h2>

      <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Market Sentiment
          </p>
          <span className={`text-xs font-medium ${textColor}`}>
            {label}
          </span>
        </div>

        {/* Large value display */}
        <div className="flex items-baseline gap-1.5 mt-1">
          <p
            className="font-[family-name:var(--font-heading)] text-xl font-bold"
            style={{ color }}
          >
            {value}
          </p>
          <span className="text-xs text-[var(--color-text-muted)]">/ 100</span>
        </div>

        {/* Gradient gauge bar */}
        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full">
          {/* Gradient background: red → orange → yellow → lime → green */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "linear-gradient(to right, #dc2626, #ea580c, #ca8a04, #65a30d, #16a34a)",
            }}
          />
          {/* Dimming overlay for unlit portion */}
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-[var(--color-bg-base)]/70"
            style={{ width: `${100 - value}%` }}
          />
          {/* Indicator dot */}
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
            style={{
              left: `clamp(4%, ${value}%, 96%)`,
              backgroundColor: color,
            }}
          />
        </div>

        {/* Scale labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-[var(--color-text-muted)]">Fear</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">Greed</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-text-secondary)]">Fear &amp; Greed Index:</span>{" "}
        aggregates volatility, momentum, social media, and dominance into a single 0-100 sentiment score. Below 25 is extreme fear (historically a buying signal); above 75 is extreme greed (historically a caution signal).
      </p>
    </section>
  );
}
