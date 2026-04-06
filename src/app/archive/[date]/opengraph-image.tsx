import { ImageResponse } from "next/og";
import { createServiceClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";
import { formatDisplayDate } from "@/lib/utils";

export const runtime = "nodejs";
export const alt = "BTC Today — Daily Bitcoin Analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { date: string } }) {
  const { date } = params;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("content")
    .eq("date", date)
    .maybeSingle();

  const briefing = data ? (data as DailyBriefingRow).content : null;

  const price = briefing
    ? `$${briefing.market_snapshot.price_usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
    : "BTC";
  const change = briefing
    ? `${briefing.market_snapshot.change_24h_pct >= 0 ? "+" : ""}${briefing.market_snapshot.change_24h_pct.toFixed(2)}%`
    : "";
  const isPositive = briefing ? briefing.market_snapshot.change_24h_pct >= 0 : true;
  const oneLine = briefing?.one_line ?? "AI-Curated Bitcoin Intelligence";
  const displayDate = formatDisplayDate(date);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 80px",
          backgroundColor: "#E2E5EE",
          fontFamily: "sans-serif",
        }}
      >
        {/* Orange accent bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            backgroundColor: "#F7931A",
          }}
        />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: "#0A0A0C" }}>
              BTC
            </span>
            <span style={{ fontSize: 32, fontWeight: 400, color: "#3A3A42" }}>
              Today
            </span>
          </div>
          <span style={{ fontSize: 22, color: "#6B7280" }}>
            {displayDate}
          </span>
        </div>

        {/* Price */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <span style={{ fontSize: 96, fontWeight: 700, color: "#0A0A0C", letterSpacing: "-0.04em" }}>
              {price}
            </span>
            {change && (
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 600,
                  color: isPositive ? "#059669" : "#DC2626",
                }}
              >
                {change}
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 24,
              color: "#3A3A42",
              lineHeight: 1.4,
              maxWidth: 800,
            }}
          >
            {oneLine}
          </p>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 18, color: "#6B7280" }}>
            btctoday.co
          </span>
          {briefing?.narrative_consensus?.label && (
            <span style={{ fontSize: 18, color: "#F7931A", fontWeight: 600 }}>
              {briefing.narrative_consensus.label}
            </span>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
