"use client";

import { useEffect, useRef, useState } from "react";
import type { MarketSnapshot, DailyDiff } from "@/lib/types";
import { formatPctChange } from "@/lib/utils";

function pctColor(pct: number): string {
  return pct >= 0 ? "text-emerald-700" : "text-red-700";
}

/** Animate a number from `from` to `to` over `duration` ms. */
function useCountUp(to: number, duration = 1200) {
  const [value, setValue] = useState(to * 0.985);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const start = to * 0.985;
    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // ease-out cubic
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
}: {
  market: MarketSnapshot;
  dailyDiff: DailyDiff;
}) {
  const animatedPrice = useCountUp(market.price_usd);

  return (
    <section className="card-glass relative mt-6 overflow-hidden rounded-2xl px-6 py-10 sm:py-14">
      {/* Background glow layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 600px 400px at 50% 30%, rgba(247, 147, 26, 0.25) 0%, transparent 70%), radial-gradient(ellipse 500px 400px at 10% 75%, rgba(59, 130, 246, 0.20) 0%, transparent 60%), radial-gradient(ellipse 400px 300px at 90% 15%, rgba(251, 191, 36, 0.12) 0%, transparent 50%)`,
        }}
      />

      {/* SVG noise texture overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundSize: "128px 128px",
        }}
      />

      <div className="relative flex flex-col items-center text-center">
        {/* Coin container */}
        <div className="relative mb-6">
          {/* Glow halo behind coin */}
          <div
            className="absolute inset-0 -m-8 rounded-full"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(247, 147, 26, 0.35) 0%, rgba(247, 147, 26, 0.10) 50%, transparent 70%)",
              animation: "coinGlow 4s ease-in-out infinite",
            }}
          />

          {/* Pulse rings */}
          <div
            className="absolute inset-0 -m-12 rounded-full border border-[var(--color-accent)]/10"
            style={{ animation: "pulseRing 3s ease-out infinite" }}
          />
          <div
            className="absolute inset-0 -m-12 rounded-full border border-[var(--color-accent)]/10"
            style={{ animation: "pulseRing 3s ease-out infinite 1.5s" }}
          />

          {/* Bitcoin coin SVG */}
          <div
            style={{
              animation: "coinFloat 12s ease-in-out infinite",
              perspective: "600px",
              transformStyle: "preserve-3d" as const,
            }}
          >
            <svg
              width="96"
              height="96"
              viewBox="0 0 96 96"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="drop-shadow-[0_0_30px_rgba(247,147,26,0.45)]"
            >
              <defs>
                <linearGradient id="coinGrad" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FCD34D" />
                  <stop offset="30%" stopColor="#F7931A" />
                  <stop offset="70%" stopColor="#EA8C0F" />
                  <stop offset="100%" stopColor="#C2710A" />
                </linearGradient>
                <linearGradient id="coinInner" x1="20" y1="20" x2="76" y2="76" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#92400E" stopOpacity="0.1" />
                </linearGradient>
                <filter id="coinShadow">
                  <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#F7931A" floodOpacity="0.3" />
                </filter>
              </defs>

              <circle cx="48" cy="48" r="46" fill="url(#coinGrad)" filter="url(#coinShadow)" />
              <circle cx="48" cy="48" r="46" fill="url(#coinInner)" />
              <circle cx="48" cy="48" r="38" fill="none" stroke="#FCD34D" strokeWidth="1.5" strokeOpacity="0.3" />

              <text
                x="48"
                y="58"
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
                fontSize="40"
                fontWeight="700"
                fill="#0A0A0A"
                fillOpacity="0.85"
              >
                ₿
              </text>

              <ellipse cx="36" cy="32" rx="14" ry="10" fill="white" fillOpacity="0.12" transform="rotate(-20 36 32)" />
            </svg>
          </div>
        </div>

        {/* Price display — animated counter */}
        <div className="font-[family-name:var(--font-heading)]">
          <p className="text-4xl font-bold text-[var(--color-text-primary)] tracking-tight sm:text-5xl"
            style={{ textShadow: "0 0 50px rgba(247, 147, 26, 0.25)" }}
          >
            {formatUSDAnimated(animatedPrice)}
          </p>
          <div className="mt-2 flex items-center justify-center gap-4 text-sm font-medium">
            <span className={pctColor(market.change_24h_pct)}>
              24h {formatPctChange(market.change_24h_pct)}
            </span>
            <span className="text-[var(--color-border)]">|</span>
            <span className={pctColor(market.change_7d_pct)}>
              7d {formatPctChange(market.change_7d_pct)}
            </span>
          </div>
        </div>

        {/* Daily diff summary */}
        <div className="mt-5 max-w-md">
          <p className="text-reveal text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {dailyDiff.sentiment_shift}
          </p>
          {dailyDiff.key_changes.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2">
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
      </div>
    </section>
  );
}
