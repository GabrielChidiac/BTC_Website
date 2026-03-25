"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketSnapshot, DailyDiff, NarrativeConsensus } from "@/lib/types";
import { formatPctChange } from "@/lib/utils";
import { SentimentGauge } from "@/components/ui/SentimentGauge";

function pctColor(pct: number): string {
  return pct >= 0 ? "text-emerald-700" : "text-red-700";
}

/** Animate a number from ~98.5% of target to target over `duration` ms. */
function useCountUp(to: number, duration = 1200) {
  const [value, setValue] = useState(to * 0.985);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = to * 0.985;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(start + (to - start) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [to, duration]);

  return value;
}

function formatUSDAnimated(amount: number): string {
  return "$" + amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function BitcoinHero({
  market,
  dailyDiff,
  consensus,
}: {
  market: MarketSnapshot;
  dailyDiff: DailyDiff;
  consensus?: NarrativeConsensus;
}) {
  const animatedPrice = useCountUp(market.price_usd);

  return (
    <section className="card-glass relative overflow-hidden rounded-2xl px-6 py-8 sm:py-10">
      {/* Background glow layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 600px 400px at 50% 30%, rgba(247, 147, 26, 0.20) 0%, transparent 70%), radial-gradient(ellipse 500px 400px at 10% 75%, rgba(59, 130, 246, 0.15) 0%, transparent 60%), radial-gradient(ellipse 400px 300px at 90% 15%, rgba(251, 191, 36, 0.10) 0%, transparent 50%)`,
        }}
      />

      {/* SVG noise texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      <div className="relative">
        {/* Top row: Today's Insight headline + Sentiment Gauge */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* "Today's Number" — the variable reward */}
            <p className="text-reveal font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold leading-snug text-[var(--color-text-primary)] tracking-tight">
              {dailyDiff.price_change}
            </p>

            {/* Price + deltas */}
            <div className="mt-3 flex items-baseline gap-4 font-[family-name:var(--font-heading)]">
              <p
                className="text-3xl sm:text-4xl font-bold text-[var(--color-accent)] tabular-nums tracking-tight"
                style={{ textShadow: "0 0 40px rgba(247, 147, 26, 0.20)" }}
              >
                {formatUSDAnimated(animatedPrice)}
              </p>
              <div className="flex items-center gap-3 text-sm font-medium tabular-nums">
                <span className={pctColor(market.change_24h_pct)}>
                  24h {formatPctChange(market.change_24h_pct)}
                </span>
                <span className="text-[var(--color-border)]">|</span>
                <span className={pctColor(market.change_7d_pct)}>
                  7d {formatPctChange(market.change_7d_pct)}
                </span>
              </div>
            </div>
          </div>

          {/* Sentiment gauge */}
          {consensus && (
            <SentimentGauge
              score={consensus.score}
              label={consensus.label}
              className="shrink-0"
            />
          )}
        </div>

        {/* Sentiment shift text */}
        <p className="text-reveal mt-4 text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
          {dailyDiff.sentiment_shift}
        </p>

        {/* Key changes as badges */}
        {dailyDiff.key_changes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {dailyDiff.key_changes.map((change, i) => (
              <span
                key={change}
                className="badge-stagger rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]"
                style={{ animationDelay: `${1.4 + i * 0.08}s` }}
              >
                {change}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
