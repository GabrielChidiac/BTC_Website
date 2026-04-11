import type { InstitutionalFlows as InstitutionalFlowsType } from "@/lib/types";

export function InstitutionalFlows({
  flows,
}: {
  flows?: InstitutionalFlowsType;
}) {
  if (!flows) return null;

  if (!flows.notable_moves || flows.notable_moves.length === 0) return null;

  return (
    <div>
      <h3 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-accent)] mb-3">
        Institutional Activity
      </h3>

      {flows.summary && flows.summary !== "Data unavailable" && (
        <p className="text-[11px] text-[var(--color-text-muted)] mb-2">
          {flows.summary.split(/[.!?]/)[0]?.trim()}.
        </p>
      )}
      <ul className="space-y-1.5">
        {flows.notable_moves.map((move, i) => (
          <li
            key={i}
            className="text-xs text-[var(--color-text-secondary)] pl-3 border-l-2 border-[var(--color-accent)]/30 leading-relaxed"
          >
            {move}
          </li>
        ))}
      </ul>
    </div>
  );
}
