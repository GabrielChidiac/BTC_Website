import type { AssetComparison } from "@/lib/types";
import { formatPctChange } from "@/lib/utils";

function pctColor(pct: number): string {
  return pct >= 0 ? "text-emerald-700" : "text-red-700";
}

function PctCell({ label, pct }: { label: string; pct: number | null | undefined }) {
  return (
    <div className="mt-2">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p
        className={`font-[family-name:var(--font-heading)] text-sm font-bold ${
          pct != null ? pctColor(pct) : "text-[var(--color-text-muted)]"
        }`}
      >
        {pct != null ? formatPctChange(pct) : "N/A"}
      </p>
    </div>
  );
}

export function BtcVsEverything({
  comparisons,
}: {
  comparisons: AssetComparison[];
}) {
  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        BTC vs Everything
      </h2>

      <div className="relative">
        <div className="flex gap-3 overflow-x-auto pb-1">
          {comparisons.map((asset) => (
            <div
              key={asset.ticker}
              className="flex-1 min-w-[160px] rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4"
            >
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                {asset.name}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {asset.ticker}
              </p>

              <PctCell label="24h" pct={asset.change_24h_pct} />
              <PctCell label="YTD" pct={asset.change_ytd_pct} />
              <PctCell label="1Y" pct={asset.change_1y_pct} />

              <div className="mt-3 pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)]">BTC outperformance</p>
                <PctCell label="24h" pct={asset.btc_relative_24h_pct} />
                <PctCell label="YTD" pct={asset.btc_relative_ytd_pct} />
              </div>
            </div>
          ))}
        </div>
        {/* Scroll fade indicator for mobile */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-bg-base)] to-transparent sm:hidden" />
      </div>
    </section>
  );
}
