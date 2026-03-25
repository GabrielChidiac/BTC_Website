import type { InstitutionalFlows as InstitutionalFlowsType } from "@/lib/types";

function formatUSD(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount >= 0 ? "+" : "-";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
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
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-1">
        Institutional Flows
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Where the smart money is moving
      </p>

      <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        {/* ETF flow headline */}
        {flows.etf_net_flow_usd !== null && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              ETF Net Flow (Daily)
            </p>
            <p
              className={`font-[family-name:var(--font-heading)] text-2xl font-bold mt-1 ${
                flows.etf_net_flow_usd >= 0 ? "text-emerald-700" : "text-red-700"
              }`}
            >
              {formatUSD(flows.etf_net_flow_usd)}
            </p>
          </div>
        )}

        {/* Flow trend */}
        {flows.etf_flow_trend && flows.etf_flow_trend !== "Data unavailable" && (
          <p className="text-sm text-[var(--color-text-secondary)] mb-4">
            {flows.etf_flow_trend}
          </p>
        )}

        {/* Total AUM */}
        {flows.etf_total_aum_usd !== null && (
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Total ETF AUM: ${(flows.etf_total_aum_usd / 1e9).toFixed(1)}B
          </p>
        )}

        {/* Notable moves */}
        {flows.notable_moves.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-3">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Notable Moves
            </p>
            <ul className="space-y-1.5">
              {flows.notable_moves.map((move, i) => (
                <li
                  key={i}
                  className="text-sm text-[var(--color-text-secondary)] pl-3 border-l-2 border-[var(--color-accent)]/40"
                >
                  {move}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
