const variantStyles = {
  bullish:
    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  bearish:
    "bg-red-50 text-red-700 border border-red-200",
  neutral:
    "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]",
  default:
    "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border border-[var(--color-accent)]/20",
} as const;

export function Badge({
  label,
  variant = "default",
}: {
  label: string;
  variant?: keyof typeof variantStyles;
}) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium leading-tight ${variantStyles[variant]}`}
    >
      {label}
    </span>
  );
}
