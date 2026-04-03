import type { InstitutionalFlows as InstitutionalFlowsType } from "@/lib/types";

export function InstitutionalFlows({
  flows,
}: {
  flows?: InstitutionalFlowsType;
}) {
  if (!flows) return null;

  const hasContent =
    (flows.notable_moves && flows.notable_moves.length > 0) ||
    (flows.etf_flow_trend && flows.etf_flow_trend !== "Data unavailable");

  if (!hasContent) return null;

  return (
    <div>
      <h3 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-accent)] mb-3">
        Institutional Flows
      </h3>

      {/* Flow trend narrative */}
      {flows.etf_flow_trend && flows.etf_flow_trend !== "Data unavailable" && (
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">
          {flows.etf_flow_trend}
        </p>
      )}

      {/* Notable moves */}
      {flows.notable_moves && flows.notable_moves.length > 0 && (
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
