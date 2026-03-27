interface SectionLabelProps {
  number: string;
  title: string;
  className?: string;
}

export function SectionLabel({ number, title, className = "" }: SectionLabelProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="section-number font-[family-name:var(--font-heading)] text-[10px] font-medium uppercase text-[var(--color-text-muted)] tracking-[0.18em]">
        {number}
      </span>
      <span className="h-px flex-1 max-w-8 bg-[var(--color-border)]" />
      <h2 className="font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
        {title}
      </h2>
    </div>
  );
}
