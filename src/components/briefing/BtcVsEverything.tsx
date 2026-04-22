import type { AssetComparison } from "@/lib/types";
import { formatPctChange } from "@/lib/utils";

function PctCell({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-[var(--color-text-muted)]">—</span>;

  const isPositive = pct >= 0;
  return (
    <span
      className={`font-[family-name:var(--font-heading)] text-sm font-bold tabular-nums ${
        isPositive ? "text-[var(--color-bullish)]" : "text-[var(--color-bearish)]"
      }`}
    >
      {formatPctChange(pct)}
    </span>
  );
}

export function BtcVsEverything({
  comparisons,
}: {
  comparisons: AssetComparison[];
}) {
  if (!comparisons || comparisons.length === 0) return null;

  return (
    <div>
      <h3 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-accent)] mb-3">
        BTC vs Everything
      </h3>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="pb-2 pr-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Asset
              </th>
              <th className="pb-2 pr-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">
                24h
              </th>
              <th className="pb-2 pr-4 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">
                YTD
              </th>
              <th className="pb-2 text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">
                BTC Edge
              </th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((asset) => (
              <tr
                key={asset.ticker}
                className="border-b border-[var(--color-border)]/50 last:border-0"
              >
                <td className="py-2.5 pr-4">
                  <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)]">
                    {asset.ticker}
                  </span>
                  <span className="ml-1.5 text-xs text-[var(--color-text-muted)] hidden sm:inline">
                    {asset.name}
                  </span>
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <PctCell pct={asset.change_24h_pct} />
                </td>
                <td className="py-2.5 pr-4 text-right">
                  <PctCell pct={asset.change_ytd_pct} />
                </td>
                <td className="py-2.5 text-right">
                  <PctCell pct={asset.btc_relative_ytd_pct} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
