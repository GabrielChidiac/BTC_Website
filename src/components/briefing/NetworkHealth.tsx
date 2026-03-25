import type { NetworkHealth as NetworkHealthType } from "@/lib/types";
import { compactNumber } from "@/lib/utils";

export function NetworkHealth({
  network,
}: {
  network: NetworkHealthType;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-1">
        Network Fundamentals
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        Security and infrastructure metrics that underpin institutional confidence
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Hashrate" value={`${compactNumber(network.hashrate_eh_s)} EH/s`} />
        <Stat label="Difficulty" value={compactNumber(network.difficulty)} />
        <Stat
          label="Block Height"
          value={network.block_height.toLocaleString("en-US")}
        />
        <Stat
          label="Mempool"
          value={`${network.mempool_tx_count.toLocaleString("en-US")} tx`}
          sub={`${network.mempool_size_mb.toFixed(1)} MB`}
        />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
            Fee Rates
          </p>
          <div className="mt-1 flex items-baseline gap-3 text-sm">
            <span className="text-emerald-700">
              <span className="text-[var(--color-text-muted)] text-xs">slow </span>
              {network.fee_slow_sat_vb}
            </span>
            <span className="text-[var(--color-accent)]">
              <span className="text-[var(--color-text-muted)] text-xs">med </span>
              {network.fee_medium_sat_vb}
            </span>
            <span className="text-red-700">
              <span className="text-[var(--color-text-muted)] text-xs">fast </span>
              {network.fee_fast_sat_vb}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">sat/vB</p>
        </div>

        {/* Halving progress */}
        <div className="col-span-2 sm:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
              Next Halving
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">
              {network.blocks_until_halving.toLocaleString("en-US")} blocks remaining
            </p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)]"
              style={{
                width: `${network.halving_progress_pct}%`,
                boxShadow: "0 0 8px var(--color-accent)",
              }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs text-[var(--color-text-muted)]">
              Supply issuance halves, a programmed scarcity event
            </p>
            <p className="text-xs font-medium text-[var(--color-accent)] shrink-0 ml-2">
              {network.halving_progress_pct.toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{sub}</p>
      )}
    </div>
  );
}
