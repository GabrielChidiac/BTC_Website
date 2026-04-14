import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { HALVING_INTERVAL } from "./constants";
import type { BriefingJSON } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date to "YYYY-MM-DD".
 */
export function toISODate(date: Date = new Date()): string {
  return date.toISOString().split("T")[0];
}

/**
 * Format a date for the header: "24 MAR 2026"
 */
export function formatBriefingDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z")
    .toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

/**
 * Format a date string for display: "March 24, 2026"
 */
export function formatDisplayDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Relative time string: "2 hours ago", "3 days ago"
 */
export function relativeTime(isoDatetime: string): string {
  const now = Date.now();
  const then = new Date(isoDatetime).getTime();
  const diffMs = now - then;

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

/**
 * Calculate halving progress and blocks remaining.
 */
export function halvingProgress(blockHeight: number): {
  progressPct: number;
  blocksRemaining: number;
} {
  const blocksSinceLastHalving = blockHeight % HALVING_INTERVAL;
  return {
    progressPct: (blocksSinceLastHalving / HALVING_INTERVAL) * 100,
    blocksRemaining: HALVING_INTERVAL - blocksSinceLastHalving,
  };
}

/**
 * Truncate text to a maximum number of words.
 */
export function truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(" ") + "…";
}

/**
 * Check if a date string is within the last N hours.
 */
export function isWithinHours(isoDatetime: string, hours: number): boolean {
  const then = new Date(isoDatetime).getTime();
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return then >= cutoff;
}

/**
 * Format large numbers compactly: 1_234_567 → "1.23M"
 */
export function compactNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

/**
 * Format USD price: $67,432.10
 */
export function formatUSD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Format percentage with sign: +2.34% or -1.56%
 */
export function formatPctChange(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

/**
 * Compute the approximate read time in seconds for a briefing, based on word
 * count of all reader-visible text fields at 200 words per minute. Powers the
 * 3-Minute Contract display at the top of the homepage and the email header.
 */
export function computeReadTimeSeconds(briefing: BriefingJSON): number {
  const wpm = 200;
  const parts: Array<string | undefined> = [
    briefing.one_line,
    briefing.hero_three_lines?.move,
    briefing.hero_three_lines?.signal,
    briefing.hero_three_lines?.watch,
    briefing.technical_signals?.signal_summary,
    briefing.daily_diff?.price_change,
    briefing.daily_diff?.sentiment_shift,
    ...(briefing.daily_diff?.key_changes ?? []),
    briefing.narrative_consensus?.label,
    briefing.narrative_consensus?.rationale,
    briefing.macro_context?.narrative,
    briefing.macro_context?.btc_correlation_note,
    ...(briefing.macro_context?.key_macro_events ?? []),
    briefing.looking_ahead,
    briefing.institutional_flows?.summary,
    ...(briefing.institutional_flows?.notable_moves ?? []),
    briefing.supply_dynamics?.exchange_reserve_trend,
    briefing.supply_dynamics?.supply_narrative,
  ];

  for (const story of briefing.top_stories ?? []) {
    parts.push(story.headline, story.summary);
  }
  for (const reg of briefing.regulatory ?? []) {
    parts.push(reg.headline, reg.summary);
  }
  for (const adopt of briefing.adoption ?? []) {
    parts.push(adopt.headline, adopt.summary);
  }
  for (const exp of briefing.expert_insights ?? []) {
    parts.push(exp.quote_or_summary);
  }
  for (const ev of briefing.countdown_events ?? []) {
    parts.push(ev.name, ev.description);
  }

  const totalWords = parts
    .filter((t): t is string => typeof t === "string" && t.length > 0)
    .reduce((sum, text) => sum + text.split(/\s+/).filter(Boolean).length, 0);

  return Math.round((totalWords / wpm) * 60);
}

/**
 * Format read time seconds as "X min Y sec", or "Y sec" under a minute.
 * Used by the ThreeMinuteHero display and the daily digest email header.
 */
export function formatReadTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  if (rem === 0) return `${minutes} min`;
  return `${minutes} min ${rem} sec`;
}
