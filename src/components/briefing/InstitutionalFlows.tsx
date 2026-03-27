import type { InstitutionalFlows as InstitutionalFlowsType } from "@/lib/types";

function formatUSD(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? "+" : "-";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(0)}M`;
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

export function InstitutionalFlows({
  flows,
}: {
  flows?: InstitutionalFlowsType;
}) {
  if (!flows) return null;

  const hasData =
    flows.etf_net_flow_usd !== null ||
    (flows.notable_moves && flows.notable_moves.length > 0) ||
    flows.etf_flow_trend !== "Data unavailable";

  if (!hasData) return null;

  return (
    <div>
      <h3 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-3">
        Institutional Flows
      </h3>

      {/* ETF flow headline */}
      {flows.etf_net_flow_usd !== null && (
        <div className="mb-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            ETF Net Flow (Daily)
          </p>
          <p
            className={`font-[family-name:var(--font-heading)] text-2xl font-bold leading-tight ${
              flows.etf_net_flow_usd >= 0 ? "text-emerald-700" : "text-red-700"
            }`}
          >
            {formatUSD(flows.etf_net_flow_usd)}
          </p>
          {flows.etf_total_aum_usd !== null && (
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Total AUM: ${(flows.etf_total_aum_usd / 1e9).toFixed(1)}B
            </p>
          )}
        </div>
      )}

      {/* Flow trend */}
      {flows.etf_flow_trend && flows.etf_flow_trend !== "Data unavailable" && (
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
          {flows.etf_flow_trend}
        </p>
      )}

      {/* Notable moves — compact */}
      {flows.notable_moves.length > 0 && (
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

      {/* Source attribution */}
      <p className="mt-3 text-[10px] text-[var(--color-text-muted)]">
        Aggregated from public reports
      </p>
    </div>
  );
}
