import type { InstitutionalFlows as InstitutionalFlowsType, ETFFlows } from "@/lib/types";

function formatUSD(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? "+" : "-";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

export function InstitutionalFlows({
  flows,
  etfFlows,
}: {
  flows?: InstitutionalFlowsType;
  etfFlows?: ETFFlows | null;
}) {
  if (!flows && !etfFlows) return null;

  const hasEtf = etfFlows && (etfFlows.daily_net_flow_usd != null || etfFlows.mtd_net_flow_usd != null);
  const hasEnrichment = flows && (
    flows.etf_net_flow_usd !== null ||
    (flows.notable_moves && flows.notable_moves.length > 0) ||
    flows.etf_flow_trend !== "Data unavailable"
  );

  if (!hasEtf && !hasEnrichment) return null;

  return (
    <div>
      <h3 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-accent)] mb-3">
        Institutional Flows
      </h3>

      {/* Real ETF data from SoSoValue */}
      {hasEtf && etfFlows && (
        <div className="mb-3">
          {etfFlows.daily_net_flow_usd != null && (
            <>
              <p className="text-xs text-[var(--color-text-muted)]">
                ETF Net Flow (24h)
              </p>
              <p
                className={`font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight ${
                  etfFlows.daily_net_flow_usd >= 0 ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {formatUSD(etfFlows.daily_net_flow_usd)}
              </p>
            </>
          )}
          {etfFlows.mtd_net_flow_usd != null && (
            <p className={`font-[family-name:var(--font-heading)] text-sm font-semibold mt-1 ${
              etfFlows.mtd_net_flow_usd >= 0 ? "text-emerald-700" : "text-red-700"
            }`}>
              MTD: {formatUSD(etfFlows.mtd_net_flow_usd)}
            </p>
          )}
          {etfFlows.total_net_assets_usd != null && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Total AUM: ${(etfFlows.total_net_assets_usd / 1e9).toFixed(1)}B
            </p>
          )}
        </div>
      )}

      {/* Enrichment: flow trend */}
      {flows?.etf_flow_trend && flows.etf_flow_trend !== "Data unavailable" && (
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
          {flows.etf_flow_trend}
        </p>
      )}

      {/* Notable moves */}
      {flows?.notable_moves && flows.notable_moves.length > 0 && (
        <ul className="space-y-1.5 border-t border-[var(--color-border)]/50 pt-3">
          {flows.notable_moves.map((move, i) => (
            <li
              key={i}
              className="text-xs text-[var(--color-text-secondary)] pl-3 border-l-2 border-[var(--color-accent)]/30 leading-relaxed"
            >
              {move}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
