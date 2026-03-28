import type { SupplyDynamics as SupplyDynamicsType } from "@/lib/types";

export function SupplyDynamics({
  supply,
}: {
  supply?: SupplyDynamicsType;
}) {
  if (!supply) return null;

  const hasData =
    supply.supply_narrative !== "Supply data unavailable today." ||
    supply.long_term_holder_pct !== null;

  if (!hasData) return null;

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-1">
        Supply Dynamics
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        On-chain scarcity signals
      </p>

      <div className="card-hover-glow rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        {supply.long_term_holder_pct !== null && (
          <div className="mb-4">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Long-Term Holders ({">"}1 year)
            </p>
            <p className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-accent)] mt-1">
              {supply.long_term_holder_pct.toFixed(1)}%
            </p>
          </div>
        )}

        {supply.exchange_reserve_trend &&
          supply.exchange_reserve_trend !== "Data unavailable" && (
            <p className="text-sm text-[var(--color-text-secondary)] mb-3 border-l-2 border-[var(--color-accent)]/40 pl-3">
              {supply.exchange_reserve_trend}
            </p>
          )}

        {supply.supply_narrative &&
          supply.supply_narrative !== "Supply data unavailable today." && (
            <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
              {supply.supply_narrative}
            </p>
          )}
      </div>
    </section>
  );
}
