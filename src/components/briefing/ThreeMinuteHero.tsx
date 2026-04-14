import type { HeroThreeLines } from "@/lib/types";
import { formatReadTime } from "@/lib/utils";

interface ThreeMinuteHeroProps {
  heroLines: HeroThreeLines | undefined;
  readTimeSeconds: number | undefined;
  fallbackInsight?: string;
}

/**
 * The 3-Minute Contract hero. Displays the read time commitment at the top
 * and the three hero lines (Move / Signal / Watch) that let a reader finish
 * the brief in under 3 minutes. If hero_three_lines is missing (for example,
 * a briefing generated before the pivot), falls back to rendering the
 * existing one_line insight so archived pages still render gracefully.
 */
export function ThreeMinuteHero({
  heroLines,
  readTimeSeconds,
  fallbackInsight,
}: ThreeMinuteHeroProps) {
  // Graceful fallback for pre-pivot briefings
  if (!heroLines) {
    if (!fallbackInsight) return null;
    return (
      <section className="mt-6 border-l-[3px] border-[var(--color-accent)] pl-4 py-1">
        <p className="font-[family-name:var(--font-heading)] text-base sm:text-lg font-bold text-[var(--color-text-primary)] leading-snug">
          {fallbackInsight}
        </p>
      </section>
    );
  }

  const readTimeLabel = readTimeSeconds ? formatReadTime(readTimeSeconds) : null;

  return (
    <section className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden">
      {readTimeLabel && (
        <div className="px-5 py-3 border-b border-[var(--color-border)]/60 bg-[var(--color-bg-elevated)]/40 flex items-baseline justify-between">
          <span className="font-[family-name:var(--font-heading)] text-[10px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Today&rsquo;s brief
          </span>
          <span className="font-[family-name:var(--font-heading)] text-xs sm:text-sm font-semibold tabular-nums text-[var(--color-accent)]">
            {readTimeLabel}
          </span>
        </div>
      )}

      <div className="divide-y divide-[var(--color-border)]/50">
        <HeroBlock label="The Move" text={heroLines.move} />
        <HeroBlock label="The Signal" text={heroLines.signal} />
        <HeroBlock label="The Watch" text={heroLines.watch} />
      </div>
    </section>
  );
}

function HeroBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="px-5 py-4 sm:py-5">
      <p className="font-[family-name:var(--font-heading)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)] mb-1.5">
        {label}
      </p>
      <p className="text-sm sm:text-base text-[var(--color-text-primary)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}
