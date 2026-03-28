"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { MarketSnapshot, DailyDiff, NarrativeConsensus } from "@/lib/types";
import { formatPctChange } from "@/lib/utils";
import { BitcoinCoin } from "./BitcoinCoin";

function pctColor(pct: number): string {
  return pct >= 0 ? "text-emerald-700" : "text-red-700";
}

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

function truncateToSentences(text: string, max: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences) return text;
  return sentences.slice(0, max).join(" ").trim();
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
  const heroRef = useRef<HTMLElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        heroRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6 }
      );

      tl.fromTo(
        priceRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.2"
      );

      tl.fromTo(
        contentRef.current,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.25"
      );

      if (badgesRef.current && badgesRef.current.children.length > 0) {
        tl.fromTo(
          badgesRef.current.children,
          { opacity: 0, y: 8 },
          { opacity: 1, y: 0, duration: 0.3, stagger: 0.05 },
          "-=0.15"
        );
      }
    });

    return () => ctx.revert();
  }, []);

  const sentimentColor = consensus
    ? consensus.score >= 25
      ? "text-emerald-700"
      : consensus.score <= -25
        ? "text-red-700"
        : "text-[var(--color-text-secondary)]"
    : "";

  return (
    <section
      ref={heroRef}
      className="card-glass relative overflow-hidden rounded-2xl px-6 py-8 sm:px-8 sm:py-10"
      style={{ opacity: 0 }}
    >
      {/* Background glow layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(ellipse 600px 400px at 50% 30%, rgba(247, 147, 26, 0.12) 0%, transparent 70%), radial-gradient(ellipse 500px 400px at 10% 75%, rgba(59, 130, 246, 0.08) 0%, transparent 60%)`,
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
        {/* Price row — big but not absurd */}
        <div
          ref={priceRef}
          className="flex items-center justify-between gap-6"
          style={{ opacity: 0 }}
        >
          <div className="flex items-baseline gap-4 font-[family-name:var(--font-heading)]">
            <p
              className="text-4xl sm:text-5xl font-bold text-[var(--color-accent)] tabular-nums tracking-tight"
              style={{ textShadow: "0 0 40px rgba(247, 147, 26, 0.15)" }}
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

          <BitcoinCoin className="shrink-0 size-10 sm:size-14 drop-shadow-[0_4px_20px_rgba(247,147,26,0.3)]" />
        </div>

        {/* Headline + sentiment */}
        <div ref={contentRef} className="mt-5" style={{ opacity: 0 }}>
          <h1 className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-[var(--color-text-primary)] tracking-[-0.02em] leading-snug max-w-2xl">
            {dailyDiff.price_change}
          </h1>

          <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
            {dailyDiff.sentiment_shift}
          </p>

          {consensus && (
            <>
              <p className="mt-2 text-xs font-medium font-[family-name:var(--font-heading)] uppercase tracking-[0.1em]">
                <span className="text-[var(--color-text-muted)]">Consensus</span>
                {" "}
                <span className={sentimentColor}>{consensus.label}</span>
              </p>
              {consensus.rationale && (
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-text-secondary)] max-w-xl">
                  {truncateToSentences(consensus.rationale, 2)}
                </p>
              )}
            </>
          )}
        </div>

        {/* Key changes as badges */}
        {dailyDiff.key_changes.length > 0 && (
          <div ref={badgesRef} className="mt-4 flex flex-wrap gap-2">
            {dailyDiff.key_changes.map((change) => (
              <span
                key={change}
                className="rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]"
                style={{ opacity: 0 }}
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
