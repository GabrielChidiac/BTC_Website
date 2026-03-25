export function LookingAhead({ content }: { content: string }) {
  if (!content) return null;

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Looking Ahead
      </h2>

      <div className="card-interactive rounded-xl border-l-4 border-l-[var(--color-accent)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-line">
          {content}
        </p>
      </div>
    </section>
  );
}
