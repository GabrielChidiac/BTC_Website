import type { DailyDiff } from "@/lib/types";

export function DailyDiffBanner({ dailyDiff }: { dailyDiff: DailyDiff }) {
  return (
    <section className="mt-6 rounded-xl border-l-4 border-l-[var(--color-accent)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)]">
          {dailyDiff.price_change}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">
          {dailyDiff.sentiment_shift}
        </span>
      </div>

      {dailyDiff.key_changes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {dailyDiff.key_changes.map((change) => (
            <li
              key={change}
              className="rounded-md bg-[var(--color-bg-elevated)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]"
            >
              {change}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
