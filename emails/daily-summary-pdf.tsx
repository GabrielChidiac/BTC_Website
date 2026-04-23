import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  Image,
} from "@react-pdf/renderer";
import type { BriefingJSON, TopStoryCategory } from "../src/lib/types";

const CATEGORY_LABELS: Record<TopStoryCategory, string> = {
  market: "MARKET",
  macro: "MACRO",
  technical: "TECHNICAL",
};

// ─── Register fonts ──────────────────────────────────────────────────────────

Font.register({
  family: "Inter",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hjQ.ttf",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fAZ9hjQ.ttf",
      fontWeight: 600,
    },
    {
      src: "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hjQ.ttf",
      fontWeight: 700,
    },
  ],
});

// ─── Colors ──────────────────────────────────────────────────────────────────

const c = {
  accent: "#F7931A",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#8A8A8A",
  bgBase: "#F4F3F1",
  bgSurface: "#FFFFFF",
  border: "#E0DFDD",
  green: "#16A34A",
  red: "#DC2626",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatUSD(amount: number, decimals = 2): string {
  return "$" + amount.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

function compactNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toString();
}

function formatDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    backgroundColor: c.bgBase,
    padding: 40,
    fontFamily: "Inter",
    fontSize: 10,
    color: c.textPrimary,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: c.accent,
  },
  logo: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: c.accent,
  },
  date: {
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 0.5,
  },

  // Price section
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 28,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  priceChange: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 4,
  },
  green: { color: c.green },
  red: { color: c.red },

  // Stats grid
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 6,
    padding: 10,
    alignItems: "center" as const,
  },
  statLabel: {
    fontSize: 7,
    fontWeight: 600,
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: 700,
  },

  // Section heading
  sectionHeading: {
    fontSize: 9,
    fontWeight: 700,
    color: c.accent,
    textTransform: "uppercase" as const,
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 16,
  },

  // Story card
  storyCard: {
    marginBottom: 10,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: c.accent,
  },
  storyCategory: {
    fontSize: 7,
    fontWeight: 700,
    color: c.accent,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  storyHeadline: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
    lineHeight: 1.3,
  },
  storySummary: {
    fontSize: 9,
    color: c.textSecondary,
    lineHeight: 1.5,
  },
  storySource: {
    fontSize: 7,
    color: c.textMuted,
    marginTop: 2,
  },

  // Consensus
  consensusBox: {
    backgroundColor: c.bgSurface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 6,
    padding: 12,
    marginTop: 16,
  },
  consensusLabel: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
  },
  consensusRationale: {
    fontSize: 9,
    color: c.textSecondary,
    lineHeight: 1.5,
  },

  // Key changes
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 12,
    fontSize: 9,
    color: c.accent,
    fontWeight: 700,
  },
  bulletText: {
    flex: 1,
    fontSize: 9,
    color: c.textSecondary,
    lineHeight: 1.5,
  },

  // Footer
  footer: {
    position: "absolute" as const,
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 7,
    color: c.textMuted,
  },
});

// ─── Component ───────────────────────────────────────────────────────────────

export function DailySummaryPDF({ briefing }: { briefing: BriefingJSON }) {
  const mkt = briefing.market_snapshot;
  const stories = briefing.top_stories.slice(0, 3);

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <Image src="https://btctoday.co/logo.png" style={{ width: 50, height: 60 }} />
          <Text style={s.date}>{formatDate(briefing.date)}</Text>
        </View>

        {/* One-liner */}
        {briefing.one_line && (
          <Text style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>
            {briefing.one_line}
          </Text>
        )}

        {/* Price */}
        <View style={s.priceRow}>
          <Text style={s.priceValue}>{formatUSD(mkt.price_usd)}</Text>
          <Text style={[s.priceChange, mkt.change_24h_pct >= 0 ? s.green : s.red]}>
            24h {formatPct(mkt.change_24h_pct)}
          </Text>
          <Text style={[s.priceChange, mkt.change_7d_pct >= 0 ? s.green : s.red]}>
            7d {formatPct(mkt.change_7d_pct)}
          </Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Market Cap</Text>
            <Text style={s.statValue}>${compactNumber(mkt.market_cap_usd)}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>24h Volume</Text>
            <Text style={s.statValue}>${compactNumber(mkt.volume_24h_usd)}</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statLabel}>Dominance</Text>
            <Text style={s.statValue}>{mkt.dominance_pct.toFixed(1)}%</Text>
          </View>
          {briefing.etf_flows?.daily_net_flow_usd != null && (
            <View style={s.statBox}>
              <Text style={s.statLabel}>ETF Flow (24h)</Text>
              <Text style={s.statValue}>
                {briefing.etf_flows.daily_net_flow_usd >= 0 ? "+" : ""}
                ${compactNumber(Math.abs(briefing.etf_flows.daily_net_flow_usd))}
              </Text>
            </View>
          )}
          {briefing.etf_flows?.mtd_net_flow_usd != null && (
            <View style={s.statBox}>
              <Text style={s.statLabel}>ETF Flow (MTD)</Text>
              <Text style={s.statValue}>
                {briefing.etf_flows.mtd_net_flow_usd >= 0 ? "+" : ""}
                ${compactNumber(Math.abs(briefing.etf_flows.mtd_net_flow_usd))}
              </Text>
            </View>
          )}
        </View>

        {/* Top Stories */}
        {stories.length > 0 && (
          <>
            <Text style={s.sectionHeading}>Top Stories</Text>
            {stories.map((story, i) => (
              <View key={i} style={s.storyCard}>
                {story.category && (
                  <Text style={s.storyCategory}>{CATEGORY_LABELS[story.category]}</Text>
                )}
                <Text style={s.storyHeadline}>{story.headline}</Text>
                <Text style={s.storySummary}>{story.summary}</Text>
                <Text style={s.storySource}>{story.source}</Text>
              </View>
            ))}
          </>
        )}

        {/* Consensus */}
        {briefing.narrative_consensus && (
          <View style={s.consensusBox}>
            <Text style={s.sectionHeading}>BTC Today Read</Text>
            <Text style={s.consensusLabel}>{briefing.narrative_consensus.label}</Text>
            <Text style={s.consensusRationale}>{briefing.narrative_consensus.rationale}</Text>
          </View>
        )}

        {/* Key Changes */}
        {briefing.daily_diff?.key_changes && briefing.daily_diff.key_changes.length > 0 && (
          <>
            <Text style={s.sectionHeading}>Key Changes</Text>
            {briefing.daily_diff.key_changes.map((change, i) => (
              <View key={i} style={s.bullet}>
                <Text style={s.bulletDot}>&#x2022;</Text>
                <Text style={s.bulletText}>{change}</Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <View style={s.footer}>
          <Text style={s.footerText}>btctoday.co</Text>
          <Text style={s.footerText}>AI-curated daily Bitcoin intelligence</Text>
        </View>
      </Page>
    </Document>
  );
}
