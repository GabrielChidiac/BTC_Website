/**
 * Renders when both `adoption` and `regulatory` arrays are empty on a day.
 * Prevents Section 05 from silently vanishing (04 → 06 jump is disorienting)
 * and preserves the seven-section mental model CLAUDE.md commits to.
 *
 * Voice: honest and short. Matches the earned-significance rule — a flat
 * day should read flat, not be padded with theater.
 */
export function EmptySignals() {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-6">
      <p className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--color-text-primary)]">
        No adoption or regulatory news today.
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
        Quiet day on the policy and corporate-treasury front. Flows and market structure are where the action is today.
      </p>
    </div>
  );
}
