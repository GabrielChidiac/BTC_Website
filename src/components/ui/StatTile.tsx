import { SparklineSVG } from "./SparklineSVG";

interface StatTileProps {
  label: string;
  value: string;
  delta?: {
    value: string;
    positive: boolean;
  };
  sublabel?: string;
  sparkline?: number[];
  className?: string;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: { value: "text-lg sm:text-xl", label: "text-[10px]" },
  md: { value: "text-2xl sm:text-3xl", label: "text-[10px]" },
  lg: { value: "text-3xl sm:text-4xl", label: "text-xs" },
} as const;

export function StatTile({
  label,
  value,
  delta,
  sublabel,
  sparkline,
  className = "",
  size = "md",
}: StatTileProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={`card-interactive rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 sm:p-5 ${className}`}
    >
      <p className={`${styles.label} font-[family-name:var(--font-heading)] font-medium uppercase tracking-[0.1em] text-[var(--color-text-muted)]`}>
        {label}
      </p>

      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className={`${styles.value} font-[family-name:var(--font-heading)] font-bold tabular-nums tracking-tight text-[var(--color-text-primary)]`}>
            {value}
          </p>
          {delta && (
            <p className={`mt-0.5 text-xs font-medium tabular-nums ${delta.positive ? "text-emerald-700" : "text-red-700"}`}>
              {delta.value}
            </p>
          )}
          {sublabel && (
            <p className="mt-0.5 text-[10px] text-[var(--color-text-muted)]">
              {sublabel}
            </p>
          )}
        </div>

        {sparkline && sparkline.length >= 2 && (
          <SparklineSVG
            data={sparkline}
            width={64}
            height={20}
            className="shrink-0 opacity-60"
          />
        )}
      </div>
    </div>
  );
}
