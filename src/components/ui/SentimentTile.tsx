import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SentimentTileProps {
  label: string;
  value: number;
  sublabel: string;
  className?: string;
}

function gaugeColor(value: number): string {
  if (value <= 25) return "#B44A3F";
  if (value <= 45) return "#E8850F";
  if (value <= 55) return "#F7931A";
  if (value <= 75) return "#3F8D6F";
  return "#0F7A5A";
}

function sublabelClass(value: number): string {
  if (value <= 25) return "text-[var(--color-bearish)]";
  if (value <= 45) return "text-[var(--color-accent-hover)]";
  if (value <= 55) return "text-[var(--color-accent)]";
  if (value <= 75) return "text-[var(--color-bullish)]/80";
  return "text-[var(--color-bullish)]";
}

export function SentimentTile({
  label,
  value,
  sublabel,
  className = "",
}: SentimentTileProps) {
  const color = gaugeColor(value);
  const textColor = sublabelClass(value);

  return (
    <Card
      className={cn(
        "card-interactive gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0",
        className
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <p className="text-[10px] font-[family-name:var(--font-heading)] font-medium uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          {label}
        </p>

        <div className="mt-1.5 flex items-end justify-between gap-2">
          <p
            className="text-lg sm:text-xl font-[family-name:var(--font-heading)] font-bold tabular-nums tracking-tight"
            style={{ color }}
          >
            {value}
            <span className="ml-1 text-xs font-medium text-[var(--color-text-muted)]">/ 100</span>
          </p>
          <span className={`text-[11px] font-medium ${textColor}`}>
            {sublabel}
          </span>
        </div>

        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "linear-gradient(to right, #dc2626, #ea580c, #ca8a04, #65a30d, #16a34a)",
            }}
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-[var(--color-bg-base)]/70"
            style={{ width: `${100 - value}%` }}
          />
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
            style={{
              left: `clamp(4%, ${value}%, 96%)`,
              backgroundColor: color,
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
