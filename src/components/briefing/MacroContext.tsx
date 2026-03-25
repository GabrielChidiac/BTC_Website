import type { MacroContext as MacroContextType } from "@/lib/types";

export function MacroContext({
  macro,
}: {
  macro?: MacroContextType;
}) {
  if (!macro) return null;

  const hasData = macro.narrative || macro.btc_correlation_note;

  if (!hasData) return null;

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-1">
        Macro Context
      </h2>
      <p className="text-xs text-[var(--color-text-muted)] mb-4">
        How Bitcoin fits into the macro picture
      </p>

      <div className="card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5">
        {macro.narrative && (
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {macro.narrative}
          </p>
        )}

        {macro.btc_correlation_note && (
          <p className="mt-3 text-sm text-[var(--color-accent-hover)] border-l-2 border-[var(--color-accent)]/40 pl-3">
            {macro.btc_correlation_note}
          </p>
        )}
      </div>
    </section>
  );
}
