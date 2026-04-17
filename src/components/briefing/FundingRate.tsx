import type { FundingRate as FundingRateType } from "@/lib/types";
import { compactNumber } from "@/lib/utils";

function rateSentiment(bps: number): { label: string; color: string } {
  if (bps > 10) return { label: "Aggressively long", color: "text-red-700" };
  if (bps > 3) return { label: "Leaning long", color: "text-amber-600" };
  if (bps > -3) return { label: "Neutral", color: "text-[var(--color-text-secondary)]" };
  if (bps > -10) return { label: "Leaning short", color: "text-amber-600" };
  return { label: "Aggressively short", color: "text-emerald-700" };
}

export function FundingRate({
  fundingRate,
}: {
  fundingRate?: FundingRateType | null;
}) {
  if (!fundingRate) return null;

  const bps = fundingRate.weighted_rate * 10_000;
  const sentiment = rateSentiment(bps);
  const isPositive = bps >= 0;

  return (
    <section>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-3">
        Funding Rate
      </h2>

      {/* Main rate card */}
      <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            OI-Weighted Average
          </p>
          <span className={`text-xs font-medium ${sentiment.color}`}>
            {sentiment.label}
          </span>
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <p
            className={`font-[family-name:var(--font-heading)] text-xl font-bold ${
              isPositive ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {isPositive ? "+" : ""}{bps.toFixed(2)} bps
          </p>
          <span className="text-xs text-[var(--color-text-muted)]">
            {fundingRate.annualized_rate_pct >= 0 ? "+" : ""}
            {fundingRate.annualized_rate_pct.toFixed(1)}% ann.
          </span>
        </div>

        {/* Funding rate bar — centered at 0 */}
        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
          <div className="absolute inset-y-0 left-0 w-1/2 bg-red-50 rounded-l-full" />
          <div className="absolute inset-y-0 right-0 w-1/2 bg-emerald-50 rounded-r-full" />
          {/* Center tick */}
          <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--color-text-muted)]/30" />
          {/* Rate indicator */}
          <div
            className={`absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full shadow-sm ${
              isPositive ? "bg-emerald-600" : "bg-red-600"
            }`}
            style={{
              left: `clamp(4%, ${50 + bps * 2}%, 96%)`,
            }}
          />
        </div>
      </div>

      {/* Open interest + per-exchange */}
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Total Open Interest
          </p>
          <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
            ${compactNumber(fundingRate.total_open_interest_usd)}
          </p>
        </div>
        <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
            By Exchange
          </p>
          {fundingRate.exchanges.map((ex) => (
            <div
              key={ex.exchange}
              className="flex items-baseline justify-between text-[11px] leading-relaxed"
            >
              <span className="text-[var(--color-text-muted)] capitalize">
                {ex.exchange}
              </span>
              <span
                className={`font-medium ${
                  ex.funding_rate >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {(ex.funding_rate * 10_000).toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        <span className="font-semibold text-[var(--color-text-secondary)]">Funding rate:</span>{" "}
        positive means longs pay shorts (bullish crowding); weighted by open interest across Binance, Bybit, and OKX.
      </p>
    </section>
  );
}
