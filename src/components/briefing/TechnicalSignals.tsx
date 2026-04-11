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
    <section>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-3">
        Technical Signals
      </h2>

      <div className="grid grid-cols-2 gap-2">
        {/* RSI */}
        <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 col-span-2">
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
            <div className="absolute inset-y-0 left-0 w-[30%] bg-emerald-100 rounded-l-full" />
            <div className="absolute inset-y-0 right-0 w-[30%] bg-red-100 rounded-r-full" />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-[var(--color-accent)] shadow-[0_0_6px_var(--color-accent)]"
              style={{ left: `clamp(0%, ${signals.rsi_14}%, 100%)` }}
            />
          </div>
        </div>

        {/* SMAs */}
        <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            50-Day Avg
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
            {formatUSD(signals.sma_50, 0)}
          </p>
        </div>
        <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            200-Day Avg
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
            {formatUSD(signals.sma_200, 0)}
          </p>
        </div>

        {/* Support / Resistance */}
        <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Support
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-emerald-700">
            {formatUSD(signals.support_level, 0)}
          </p>
        </div>
        <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Resistance
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-red-700">
            {formatUSD(signals.resistance_level, 0)}
          </p>
        </div>

        {/* Signal summary */}
        <div className="col-span-2 border-l-2 border-l-[var(--color-accent)]/40 pl-3 py-1">
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {signals.signal_summary}
          </p>
        </div>
      </div>
    </section>
  );
}
