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

      {/* Signal summary — placed above the metrics as the inverted-pyramid
          take. A reader who scans for 5 seconds gets the synthesis; the
          grid below supplies the supporting evidence. */}
      <div className="mb-3 border-l-2 border-l-[var(--color-accent)]/60 pl-3 py-1.5">
        <p className="text-sm font-medium leading-relaxed text-[var(--color-text-primary)]">
          {signals.signal_summary}
        </p>
      </div>

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
      </div>

      {/* Glossary footer — visible reference for readers new to the metrics.
          Plain adult language, no ELI5 voice. */}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-text-secondary)]">RSI (Relative Strength Index):</span>{" "}
        momentum gauge from 0 to 100. Above 70 is overheated, below 30 oversold.
        {" "}
        <span className="font-semibold text-[var(--color-text-secondary)]">50 and 200-day averages:</span>{" "}
        average closing price over the last 50 or 200 days, used to judge trend direction. Price above both is a structural uptrend.
        {" "}
        <span className="font-semibold text-[var(--color-text-secondary)]">Support, Resistance:</span>{" "}
        price levels where buyers or sellers have historically stepped in. Breaks of these levels often trigger larger moves.
      </p>
    </section>
  );
}
