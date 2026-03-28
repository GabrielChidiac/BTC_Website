import type { TechnicalSignals as TechnicalSignalsType } from "@/lib/types";
import { formatUSD } from "@/lib/utils";

function rsiZone(rsi: number): { label: string; color: string } {
  if (rsi >= 70) return { label: "Might be overheated", color: "text-red-700" };
  if (rsi >= 60) return { label: "Running warm", color: "text-amber-600" };
  if (rsi >= 40) return { label: "Neutral zone", color: "text-[var(--color-text-secondary)]" };
  if (rsi >= 30) return { label: "Running cool", color: "text-amber-600" };
  return { label: "Might be undervalued", color: "text-emerald-700" };
}

export function TechnicalSignals({
  signals,
}: {
  signals: TechnicalSignalsType;
}) {
  const zone = rsiZone(signals.rsi_14);

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Technical Signals
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {/* RSI */}
        <div className="card-hover-glow rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 col-span-2">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Momentum (RSI)
            </p>
            <span className={`text-xs font-medium ${zone.color}`}>
              {zone.label}
            </span>
          </div>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-xl font-bold text-[var(--color-text-primary)]">
            {signals.rsi_14.toFixed(1)}
          </p>
          {/* RSI bar */}
          <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            {/* Zone indicators */}
            <div className="absolute inset-y-0 left-0 w-[30%] bg-emerald-100 rounded-l-full" />
            <div className="absolute inset-y-0 right-0 w-[30%] bg-red-100 rounded-r-full" />
            {/* Indicator dot */}
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--color-accent)] shadow-[0_0_6px_var(--color-accent)]"
              style={{ left: `clamp(0%, ${signals.rsi_14}%, 100%)` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
            Measures buying/selling pressure. Below 30 may signal a buying opportunity; above 70 may mean a pullback is due.
          </p>
        </div>

        {/* SMAs */}
        <div className="card-hover-glow rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            50-Day Average
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
            {formatUSD(signals.sma_50, 0)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Short-term trend</p>
        </div>
        <div className="card-hover-glow rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            200-Day Average
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
            {formatUSD(signals.sma_200, 0)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Long-term trend</p>
        </div>

        {/* Support / Resistance */}
        <div className="card-hover-glow rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            30-Day Low
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-emerald-700">
            {formatUSD(signals.support_level, 0)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Support level</p>
        </div>
        <div className="card-hover-glow rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            30-Day High
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-red-700">
            {formatUSD(signals.resistance_level, 0)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">Resistance level</p>
        </div>

        {/* Signal summary */}
        <div className="card-hover-glow col-span-2 rounded-xl border-l-4 border-l-[var(--color-accent)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {signals.signal_summary}
          </p>
        </div>
      </div>
    </section>
  );
}
