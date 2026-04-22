/**
 * Honest, short one-liner shown on days the AI Brain fell back to the
 * data-derived template generator (both Anthropic and Kie.ai unavailable).
 * The briefing still ships — this note explains why the commentary reads
 * lighter than usual without apology or "Data Unavailable" language.
 */
export function EditorsNote() {
  return (
    <aside
      aria-label="Editor's note"
      className="mt-10 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]"
    >
      <span className="font-[family-name:var(--font-heading)] font-semibold uppercase tracking-[0.12em] text-[11px] text-[var(--color-text-muted)]">
        Editor&rsquo;s note
      </span>
      <p className="mt-1">
        Today&rsquo;s commentary is lighter than usual. Full analytical brief resumes tomorrow.
      </p>
    </aside>
  );
}
