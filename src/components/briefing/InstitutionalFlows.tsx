import type { InstitutionalFlows as InstitutionalFlowsType } from "@/lib/types";

export function InstitutionalFlows({
  flows,
}: {
  flows?: InstitutionalFlowsType;
}) {
  if (!flows) return null;

  const hasNotableMoves = !!flows.notable_moves && flows.notable_moves.length > 0;
  const hasSummary = !!flows.summary && flows.summary !== "Data unavailable";

  if (!hasNotableMoves && !hasSummary) return null;

  return (
    <div>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Institutional Activity
      </h2>

      {hasSummary && (
        <p className="text-xs text-[var(--color-text-muted)] mb-4">
          {flows.summary.split(/[.!?]/)[0]?.trim()}.
        </p>
      )}

      {hasNotableMoves && (
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
      )}
    </div>
  );
}
