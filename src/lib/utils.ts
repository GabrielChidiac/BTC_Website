import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { HALVING_INTERVAL } from "./constants";

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
