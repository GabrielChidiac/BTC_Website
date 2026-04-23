import type { InstitutionalFlows as InstitutionalFlowsType } from "@/lib/types";
import { flowMoveText, flowMoveUrl } from "@/lib/utils";

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
    <section>
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-3">
        Institutional Activity
      </h2>

      {hasSummary && (
        <p className="text-xs text-[var(--color-text-muted)] mb-3">
          {flows.summary.split(/[.!?]/)[0]?.trim()}.
        </p>
      )}

      {hasNotableMoves && (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {flows.notable_moves.map((move, i) => {
            const text = flowMoveText(move);
            const url = flowMoveUrl(move);
            return (
              <li
                key={i}
                className="text-xs text-[var(--color-text-secondary)] pl-3 border-l-2 border-[var(--color-accent)]/30 leading-relaxed"
              >
                {text}
                {url && (
                  <>
                    {" "}
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--color-accent)] hover:underline"
                      aria-label="Primary source"
                    >
                      [source]
                    </a>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
