"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatDisplayDate, formatUSD, formatPctChange } from "@/lib/utils";

export interface ArchiveEntry {
  date: string;
  price: number;
  change24h: number;
  oneLine: string | null;
  consensusLabel: string | null;
}

function pctColor(pct: number): string {
  return pct >= 0 ? "text-[var(--color-bullish)]" : "text-[var(--color-bearish)]";
}

function formatMonthHeader(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function ArchiveList({ entries }: { entries: ArchiveEntry[] }) {
  const [search, setSearch] = useState("");

  // Filter entries by search term
  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.oneLine?.toLowerCase().includes(q) ||
        e.consensusLabel?.toLowerCase().includes(q) ||
        e.date.includes(q)
    );
  }, [entries, search]);

  // Group by month
  const grouped = useMemo(() => {
    const map = new Map<string, ArchiveEntry[]>();
    for (const entry of filtered) {
      const monthKey = entry.date.slice(0, 7);
      if (!map.has(monthKey)) map.set(monthKey, []);
      map.get(monthKey)!.push(entry);
    }
    return map;
  }, [filtered]);

  return (
    <div>
      {/* Search input */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by date, insight, or consensus..."
          className="h-10 w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40 transition-colors"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-12">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No briefings match your search.
          </p>
          <button
            onClick={() => setSearch("")}
            className="mt-3 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
          >
            Clear search
          </button>
        </div>
      ) : (
        <>
          {/* Table header — hidden on mobile, visible on sm+ */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_auto_auto] sm:gap-4 sm:px-4 sm:pb-3 sm:border-b sm:border-[var(--color-border)]">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
              Date
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] text-right w-28">
              Price
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)] text-right w-20">
              24h
            </span>
          </div>

          {Array.from(grouped.entries()).map(([monthKey, monthEntries]) => (
            <div key={monthKey}>
              {/* Month header */}
              <div className="mt-6 mb-2 px-4">
                <h3 className="font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  {formatMonthHeader(monthKey)}
                </h3>
              </div>

              {/* Briefing rows */}
              <div className="flex flex-col">
                {monthEntries.map((entry) => (
                  <Link
                    key={entry.date}
                    href={`/archive/${entry.date}`}
                    className="group grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] sm:gap-4 items-center rounded-lg px-4 py-4 border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-surface)]"
                  >
                    {/* Date */}
                    <div>
                      <time
                        dateTime={entry.date}
                        className="font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors"
                      >
                        {formatDisplayDate(entry.date)}
                      </time>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5 sm:hidden">
                        {formatUSD(entry.price)}{" "}
                        <span className={pctColor(entry.change24h)}>
                          {formatPctChange(entry.change24h)}
                        </span>
                      </p>
                      {entry.oneLine && (
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 line-clamp-1 max-w-md">
                          {entry.oneLine}
                        </p>
                      )}
                    </div>

                    {/* Price — desktop only */}
                    <span className="hidden sm:block font-[family-name:var(--font-heading)] text-sm font-semibold text-[var(--color-text-primary)] text-right w-28">
                      {formatUSD(entry.price)}
                    </span>

                    {/* 24h change — desktop only */}
                    <span
                      className={`hidden sm:block text-sm font-medium text-right w-20 ${pctColor(entry.change24h)}`}
                    >
                      {formatPctChange(entry.change24h)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
