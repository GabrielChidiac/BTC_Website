import type { MarketSnapshot as MarketSnapshotType } from "@/lib/types";
import {
  formatUSD,
  formatPctChange,
  compactNumber,
} from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: { text: string; positive?: boolean };
}) {
  return (
    <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
      {sub && (
        <p
          className={`mt-0.5 text-xs font-medium ${
            sub.positive === undefined
              ? "text-[var(--color-text-secondary)]"
              : sub.positive
                ? "text-emerald-700"
                : "text-red-700"
          }`}
        >
          {sub.text}
        </p>
      )}
    </div>
  );
}

export function MarketSnapshot({
  market,
}: {
  market: MarketSnapshotType;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Market Snapshot
      </h2>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Market Cap"
          value={`$${compactNumber(market.market_cap_usd)}`}
        />
        <StatCard
          label="24h Volume"
          value={`$${compactNumber(market.volume_24h_usd)}`}
        />
        <StatCard
          label="Dominance"
          value={`${market.dominance_pct.toFixed(1)}%`}
        />
      </div>
    </section>
  );
}
