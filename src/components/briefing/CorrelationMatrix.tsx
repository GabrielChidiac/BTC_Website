import type { CorrelationMatrix as CorrelationMatrixType } from "@/lib/types";

function corrColor(r: number | null): string {
  if (r === null) return "text-[var(--color-text-muted)]";
  if (r >= 0.5) return "text-emerald-700";
  if (r >= 0.2) return "text-emerald-600/80";
  if (r > -0.2) return "text-[var(--color-text-secondary)]";
  if (r > -0.5) return "text-red-600/80";
  return "text-red-700";
}

function corrLabel(r: number | null): string {
  if (r === null) return "N/A";
  const abs = Math.abs(r);
  if (abs >= 0.7) return r > 0 ? "Strong positive" : "Strong negative";
  if (abs >= 0.4) return r > 0 ? "Moderate positive" : "Moderate negative";
  if (abs >= 0.2) return r > 0 ? "Weak positive" : "Weak negative";
  return "Near zero";
}

export function CorrCard({
  label,
  ticker,
  value,
  dataPoints,
}: {
  label: string;
  ticker: string;
  value: number | null;
  dataPoints: number;
}) {
  const display = value !== null ? (value >= 0 ? "+" : "") + value.toFixed(2) : "N/A";

  return (
    <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          BTC vs {ticker}
        </p>
        <span className={`text-[11px] font-medium ${corrColor(value)}`}>
          {corrLabel(value)}
        </span>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</p>
      <p className={`mt-1 font-[family-name:var(--font-heading)] text-xl font-bold ${corrColor(value)}`}>
        {display}
      </p>
      {/* Correlation bar — centered at 0 */}
      {value !== null && (
        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-red-50 rounded-l-full" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-emerald-50 rounded-r-full" />
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--color-text-muted)]/30" />
          <div
            className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full shadow-sm ${
              value >= 0 ? "bg-emerald-600" : "bg-red-600"
            }`}
            style={{
              left: `clamp(4%, ${50 + value * 50}%, 96%)`,
            }}
          />
        </div>
      )}
      <p className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
        {dataPoints} trading days
      </p>
    </div>
  );
}

export function CorrelationMatrix({
  correlation,
}: {
  correlation?: CorrelationMatrixType | null;
}) {
  if (!correlation) return null;

  return (
    <section>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-3">
        90-Day Correlations
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <CorrCard
          label="Safe-haven signal"
          ticker="Gold"
          value={correlation.btc_gold_90d}
          dataPoints={correlation.data_points_gold}
        />
        <CorrCard
          label="Risk-asset signal"
          ticker="S&P 500"
          value={correlation.btc_sp500_90d}
          dataPoints={correlation.data_points_sp500}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-text-secondary)]">Pearson r</span>{" "}
        over 90 trading days: +1 lockstep, 0 no relationship, -1 inverse.
      </p>
    </section>
  );
}
