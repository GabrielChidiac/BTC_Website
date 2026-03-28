import type { NetworkHealth as NetworkHealthType } from "@/lib/types";

function formatHashrate(ehps: number): string {
  if (ehps >= 1000) return `${(ehps / 1000).toFixed(1)} ZH/s`;
  return `${ehps.toFixed(0)} EH/s`;
}

function formatDifficulty(diff: number): string {
  if (diff >= 1e12) return `${(diff / 1e12).toFixed(1)}T`;
  if (diff >= 1e9) return `${(diff / 1e9).toFixed(1)}B`;
  return diff.toLocaleString("en-US");
}

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
        Security and infrastructure metrics from Mempool.space
      </p>

      <div className="grid grid-cols-2 gap-3">
        {/* Hashrate */}
        <Stat label="Hashrate" value={formatHashrate(network.hashrate_eh_s)} />

        {/* Block Height */}
        <Stat
          label="Block Height"
          value={network.block_height.toLocaleString("en-US")}
        />

        {/* Difficulty */}
        <Stat label="Difficulty" value={formatDifficulty(network.difficulty)} />

        {/* Mempool */}
        <Stat
          label="Mempool"
          value={`${network.mempool_tx_count.toLocaleString("en-US")} tx`}
          sub={`${network.mempool_size_mb.toFixed(1)} MB`}
        />

        {/* Halving progress */}
        <div className="card-interactive col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
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
          <p className="mt-1.5 text-xs font-medium text-[var(--color-accent)] text-right">
            {network.halving_progress_pct.toFixed(1)}%
          </p>
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
    <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] tabular-nums">
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{sub}</p>
      )}
    </div>
  );
}

