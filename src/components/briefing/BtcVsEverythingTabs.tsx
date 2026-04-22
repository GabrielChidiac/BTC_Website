"use client";

import { useState } from "react";
import type { AssetComparison, CorrelationMatrix } from "@/lib/types";
import { formatPctChange, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { CorrCard } from "@/components/briefing/CorrelationMatrix";

function getValues(asset: AssetComparison, period: string) {
  switch (period) {
    case "24h":
      return { change: asset.change_24h_pct, edge: asset.btc_relative_24h_pct };
    case "ytd":
      return { change: asset.change_ytd_pct, edge: asset.btc_relative_ytd_pct };
    case "1y":
      return { change: asset.change_1y_pct, edge: asset.btc_relative_1y_pct };
    default:
      return { change: null, edge: null };
  }
}

function PctCell({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-[var(--color-text-muted)]">—</span>;
  const isPositive = pct >= 0;
  return (
    <span
      className={`font-[family-name:var(--font-heading)] text-sm font-bold tabular-nums ${
        isPositive ? "text-[var(--color-bullish)]" : "text-[var(--color-bearish)]"
      }`}
    >
      {formatPctChange(pct)}
    </span>
  );
}

function EdgeBar({ pct }: { pct: number | null | undefined }) {
  if (pct == null) return <span className="text-[var(--color-text-muted)]">—</span>;

  const isPositive = pct >= 0;
  const maxWidth = Math.min(Math.abs(pct) * 3, 100);

  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-16 rounded-full bg-[var(--color-border)]/50 overflow-hidden">
        <div
          className="bar-grow visible absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${maxWidth}%`,
            backgroundColor: isPositive ? "#047857" : "#DC2626",
          }}
        />
      </div>
      <PctCell pct={pct} />
    </div>
  );
}

const VISIBLE_ROWS = 3;

function ComparisonTable({
  comparisons,
  period,
}: {
  comparisons: AssetComparison[];
  period: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const visibleRows = showAll ? comparisons : comparisons.slice(0, VISIBLE_ROWS);
  const hiddenCount = comparisons.length - VISIBLE_ROWS;

  return (
    <>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="pb-2 pr-4 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                Asset
              </th>
              <th className="pb-2 pr-4 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">
                Change
              </th>
              <th className="pb-2 text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider text-right">
                BTC Edge
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((asset) => {
              const { change, edge } = getValues(asset, period);
              return (
                <tr
                  key={asset.ticker}
                  className="border-b border-[var(--color-border)]/50 last:border-0"
                >
                  <td className="py-2.5 pr-4">
                    <span className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)]">
                      {asset.ticker}
                    </span>
                    <span className="ml-1.5 text-xs text-[var(--color-text-muted)] hidden sm:inline">
                      {asset.name}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <PctCell pct={change} />
                  </td>
                  <td className="py-2.5">
                    <div className="flex justify-end">
                      <EdgeBar pct={edge} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors cursor-pointer"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            className="expand-chevron"
            data-open={showAll}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {showAll ? "Show less" : `${hiddenCount} more asset${hiddenCount !== 1 ? "s" : ""}`}
        </button>
      )}
    </>
  );
}

export function BtcVsEverythingTabs({
  comparisons,
  correlation,
}: {
  comparisons: AssetComparison[];
  correlation?: CorrelationMatrix | null;
}) {
  const [corrOpen, setCorrOpen] = useState(false);

  if (!comparisons || comparisons.length === 0) return null;

  return (
    <Card className="h-full card-interactive gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
      <CardContent className="p-4 sm:p-5">
        <Tabs defaultValue="ytd" className="gap-0">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-accent)]">
              BTC vs Everything
            </h3>
            <TabsList className="h-auto bg-[var(--color-bg-base)] p-1 rounded-lg">
              <TabsTrigger
                value="24h"
                className="rounded-md px-3 py-1 text-[11px] font-[family-name:var(--font-heading)] font-semibold uppercase tracking-[0.08em] data-active:bg-[var(--color-bg-surface)] data-active:text-[var(--color-accent)] data-active:shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                24h
              </TabsTrigger>
              <TabsTrigger
                value="ytd"
                className="rounded-md px-3 py-1 text-[11px] font-[family-name:var(--font-heading)] font-semibold uppercase tracking-[0.08em] data-active:bg-[var(--color-bg-surface)] data-active:text-[var(--color-accent)] data-active:shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                YTD
              </TabsTrigger>
              <TabsTrigger
                value="1y"
                className="rounded-md px-3 py-1 text-[11px] font-[family-name:var(--font-heading)] font-semibold uppercase tracking-[0.08em] data-active:bg-[var(--color-bg-surface)] data-active:text-[var(--color-accent)] data-active:shadow-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                1Y
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="24h">
            <ComparisonTable comparisons={comparisons} period="24h" />
          </TabsContent>
          <TabsContent value="ytd">
            <ComparisonTable comparisons={comparisons} period="ytd" />
          </TabsContent>
          <TabsContent value="1y">
            <ComparisonTable comparisons={comparisons} period="1y" />
          </TabsContent>
        </Tabs>

        {/* Pro-only: 90-day correlations collapsible reveal. Hidden for free
            users (who receive correlation={null}). */}
        {correlation && (
          <Collapsible
            open={corrOpen}
            onOpenChange={setCorrOpen}
            className="mt-4 border-t border-[var(--color-border)] pt-3"
          >
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left cursor-pointer group">
              <span className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-accent)] group-hover:text-[var(--color-accent-hover)] transition-colors">
                90-day correlations
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className={cn(
                  "text-[var(--color-accent)] transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                  corrOpen && "rotate-180"
                )}
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden transition-[height,opacity] data-[ending-style]:h-0 data-[starting-style]:h-0">
              <div className="mt-3 grid grid-cols-2 gap-2">
                <CorrCard
                  label="Safe-haven signal"
                  ticker="Gold"
                  value={correlation.btc_gold_90d}
                  dataPoints={correlation.data_points_gold}
                />
                <CorrCard
                  label="Risk-asset signal"
                  ticker="S&P 500"
                  value={correlation.btc_sp500_90d}
                  dataPoints={correlation.data_points_sp500}
                />
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
                <span className="font-semibold text-[var(--color-text-secondary)]">Pearson r</span>{" "}
                over 90 trading days: +1 lockstep, 0 no relationship, -1 inverse.
              </p>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
