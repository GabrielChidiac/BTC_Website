import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Row,
  Column,
  Heading,
  Text,
  Link,
  Hr,
  Font,
} from "@react-email/components";
import type { BriefingJSON } from "../src/lib/types";

// ─── Palette (inline — CSS variables not supported in email) ──────────────────
const colors = {
  bgBase: "#F4F3F1",
  bgSurface: "#FFFFFF",
  bgElevated: "#F9F8F6",
  accent: "#F7931A",
  accentHover: "#FFB347",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#8A8A8A",
  border: "#E0DFDD",
  green: "#16A34A",
  red: "#DC2626",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUSD(amount: number, decimals = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
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

function formatDisplayDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function pctColor(pct: number): string {
  return pct >= 0 ? colors.green : colors.red;
}

function sentimentColor(sentiment: "bullish" | "bearish" | "neutral"): string {
  if (sentiment === "bullish") return colors.green;
  if (sentiment === "bearish") return colors.red;
  return colors.textSecondary;
}

function sentimentDot(sentiment: "bullish" | "bearish" | "neutral"): string {
  if (sentiment === "bullish") return "\u25B2"; // ▲
  if (sentiment === "bearish") return "\u25BC"; // ▼
  return "\u25CF"; // ●
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DailyDigestProps {
  briefing: BriefingJSON;
  siteUrl: string;
  name?: string;
}

// ─── Preview defaults for React Email dev server ──────────────────────────────

const previewBriefing: BriefingJSON = {
  date: "2026-03-24",
  top_stories: [
    {
      headline: "Bitcoin Surges Past $90K on Institutional Demand",
      source: "CoinDesk",
      url: "https://coindesk.com",
      summary:
        "Bitcoin rallied above $90,000 driven by renewed institutional buying and record ETF inflows. The surge came alongside favorable regulatory signals from the SEC.",
      sentiment: "bullish",
      tags: ["ETF", "institutional"],
    },
    {
      headline: "SEC Relaxes Crypto Custody Rules for Banks",
      source: "The Block",
      url: "https://theblock.co",
      summary:
        "New SEC guidance allows banks to custody crypto without special capital charges, removing a key barrier for institutional access.",
      sentiment: "bullish",
      tags: ["regulation", "custody"],
    },
    {
      headline: "Mining Difficulty Hits All-Time High",
      source: "Bitcoin Magazine",
      url: "https://bitcoinmagazine.com",
      summary:
        "Difficulty reached 95.67T, signaling strong miner commitment despite compressed margins as the halving approaches.",
      sentiment: "neutral",
      tags: ["mining", "halving"],
    },
  ],
  market_snapshot: {
    price_usd: 91247.53,
    change_24h_pct: 3.42,
    change_7d_pct: 8.91,
    market_cap_usd: 1_812_000_000_000,
    volume_24h_usd: 48_300_000_000,
    dominance_pct: 61.2,
    ath_usd: 125_000,
    ath_date: "2025-12-17T00:00:00Z",
  },
  technical_signals: {
    rsi_14: 62.4,
    sma_50: 84320,
    sma_200: 71580,
    support_level: 87500,
    resistance_level: 95000,
    signal_summary: "Price holds above the 200-day MA with RSI suggesting room to run before overheated territory.",
  },
  btc_vs_everything: [
    { name: "S&P 500", ticker: "SPX", change_24h_pct: 0.45, change_ytd_pct: 8.2, change_1y_pct: 12.1, btc_relative_24h_pct: 2.97, btc_relative_ytd_pct: 41.8 },
    { name: "Gold", ticker: "XAU", change_24h_pct: -0.12, change_ytd_pct: 5.3, change_1y_pct: 18.4, btc_relative_24h_pct: 3.54, btc_relative_ytd_pct: 44.7 },
    { name: "DXY", ticker: "DXY", change_24h_pct: -0.31, change_ytd_pct: -2.1, change_1y_pct: -4.5, btc_relative_24h_pct: 3.73, btc_relative_ytd_pct: 52.1 },
  ],
  network_health: {
    hashrate_eh_s: 745.2,
    difficulty: 95_670_000_000_000,
    block_height: 892_140,
    mempool_tx_count: 32_451,
    mempool_size_mb: 18.7,
    fee_fast_sat_vb: 42,
    fee_medium_sat_vb: 18,
    fee_slow_sat_vb: 8,
    halving_progress_pct: 72.4,
    blocks_until_halving: 57_860,
  },
  daily_diff: {
    price_change: "+$3,012 (+3.42%)",
    sentiment_shift: "Institutional inflows drove sentiment higher",
    key_changes: ["ETF inflows surged", "SEC eased custody rules"],
  },
  countdown_events: [],
  looking_ahead: "Markets will watch for Friday's PCE inflation data and its impact on Fed rate expectations.",
  regulatory: [
    {
      headline: "SEC Eases Crypto Custody Requirements for Banks",
      region: "US",
      summary: "New guidance allows banks to custody digital assets without punitive capital charges, removing the SAB 121 barrier for institutional custody.",
      impact: "positive",
      source: "The Block",
      url: "https://theblock.co",
    },
  ],
  adoption: [
    {
      headline: "Top-10 US Bank to Offer Bitcoin Custody",
      category: "institutional",
      summary: "Following relaxed SEC guidance, a major bank will offer Bitcoin custody to institutional clients by Q3 2026.",
      source: "CoinDesk",
      url: "https://coindesk.com",
    },
  ],
  narrative_consensus: {
    score: 65,
    label: "Cautiously Optimistic",
    rationale: "Institutional positioning is net long with ETF inflows accelerating. Macro backdrop supportive as DXY weakens.",
  },
  macro_context: {
    narrative: "The Fed held rates steady while global liquidity conditions eased. DXY weakness and expanding M2 provide a supportive backdrop for risk assets.",
    btc_correlation_note: "BTC decoupling from equities, trading more like a macro hedge against dollar debasement.",
    key_macro_events: ["FOMC meeting Mar 18-19", "PCE inflation Mar 28"],
  },
  institutional_flows: {
    etf_net_flow_usd: 420_000_000,
    etf_total_aum_usd: 115_000_000_000,
    etf_flow_trend: "5 consecutive days of net inflows totaling $1.8B",
    notable_moves: ["MicroStrategy purchased 12,000 BTC ($1.1B)"],
  },
  supply_dynamics: {
    exchange_reserve_trend: "Exchange reserves at 5-year low, declining for 8 consecutive months",
    long_term_holder_pct: 71.2,
    supply_narrative: "Only 3.125 BTC mined per block and 71% of supply hasn't moved in over a year — the tightest supply conditions since 2017.",
  },
  expert_insights: [
    {
      expert_name: "Lyn Alden",
      role: "Macro analyst",
      quote_or_summary: "Global liquidity expansion is the dominant driver right now. Bitcoin tends to perform well when M2 is expanding, and we're seeing that across all major economies.",
      source: "The Investors Podcast",
      date: "2026-03-22",
    },
  ],
  fear_greed: { value: 72, label: "Greed" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DailyDigest({
  briefing = previewBriefing,
  siteUrl = "https://btctoday.co",
  name,
}: DailyDigestProps) {
  const { market_snapshot: mkt, top_stories, daily_diff, regulatory, adoption } = briefing;
  const stories = top_stories.slice(0, 3);
  const briefingUrl = "%%BRIEFING_URL%%";
  const greeting = name ? `Good morning, ${name}.` : "Good morning.";

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font
          fontFamily="Georgia"
          fallbackFontFamily="serif"
        />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>
        BTC {formatUSD(mkt.price_usd)} ({formatPct(mkt.change_24h_pct)})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logo}>
              BTC <span style={{ color: colors.accent }}>Today</span>
            </Text>
            <Text style={styles.date}>
              {formatDisplayDate(briefing.date)}
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Greeting ─────────────────────────────────────────────── */}
          <Section style={{ padding: "16px 0 0" }}>
            <Text style={styles.greeting}>{greeting}</Text>
          </Section>

          {/* ── Daily Diff Banner ──────────────────────────────────── */}
          <Section style={styles.diffBanner}>
            <Text style={styles.diffPrice}>
              {daily_diff.price_change}
            </Text>
            <Text style={styles.diffNarrative}>
              {daily_diff.sentiment_shift}
            </Text>
          </Section>

          {/* ── Market Snapshot ─────────────────────────────────────── */}
          <Section style={styles.section}>
            <Heading as="h2" style={styles.sectionHeading}>
              Market Snapshot
            </Heading>

            {/* Price hero */}
            <Section style={styles.priceHero}>
              <Text style={styles.priceLabel}>Bitcoin</Text>
              <Text style={styles.priceValue}>
                {formatUSD(mkt.price_usd)}
              </Text>
              <Text style={styles.priceChanges}>
                <span style={{ color: pctColor(mkt.change_24h_pct) }}>
                  24h {formatPct(mkt.change_24h_pct)}
                </span>
                {"   "}
                <span style={{ color: pctColor(mkt.change_7d_pct) }}>
                  7d {formatPct(mkt.change_7d_pct)}
                </span>
              </Text>
            </Section>

            {/* Stat grid */}
            <Section style={{ padding: "0" }}>
              <Row>
                <Column style={styles.statCell}>
                  <Text style={styles.statLabel}>Market Cap</Text>
                  <Text style={styles.statValue}>${compactNumber(mkt.market_cap_usd)}</Text>
                </Column>
                <Column style={styles.statCell}>
                  <Text style={styles.statLabel}>24h Volume</Text>
                  <Text style={styles.statValue}>${compactNumber(mkt.volume_24h_usd)}</Text>
                </Column>
                <Column style={styles.statCell}>
                  <Text style={styles.statLabel}>Dominance</Text>
                  <Text style={styles.statValue}>{mkt.dominance_pct.toFixed(1)}%</Text>
                </Column>
              </Row>
            </Section>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Top Stories ─────────────────────────────────────────── */}
          <Section style={styles.section}>
            <Heading as="h2" style={styles.sectionHeading}>
              Top Stories
            </Heading>

            {stories.map((story, i) => (
              <Section key={i} style={i < stories.length - 1 ? styles.storyCard : styles.storyCardLast}>
                <Text style={styles.storyMeta}>
                  <span style={{ color: sentimentColor(story.sentiment) }}>
                    {sentimentDot(story.sentiment)}
                  </span>
                  {"  "}
                  <span style={{ color: colors.textMuted }}>
                    {story.source}
                  </span>
                  {story.tags.length > 0 && (
                    <span style={{ color: colors.textMuted }}>
                      {" / "}
                      {story.tags.join(", ")}
                    </span>
                  )}
                </Text>
                <Link href={story.url} style={styles.storyHeadline}>
                  {story.headline}
                </Link>
                <Text style={styles.storySummary}>
                  {story.summary}
                </Text>
              </Section>
            ))}
          </Section>

          <Hr style={styles.hr} />

          {/* ── Regulatory Spotlight ──────────────────────────────── */}
          {regulatory && regulatory.length > 0 && (
            <>
              <Section style={styles.section}>
                <Heading as="h2" style={styles.sectionHeading}>
                  Regulatory Spotlight
                </Heading>
                <Section style={styles.storyCardLast}>
                  <Text style={styles.storyMeta}>
                    <span style={{ color: colors.accent }}>{regulatory[0].region}</span>
                    {"  "}
                    <span style={{ color: colors.textMuted }}>
                      {regulatory[0].source}
                    </span>
                  </Text>
                  <Text style={styles.storyHeadline}>
                    {regulatory[0].headline}
                  </Text>
                  <Text style={styles.storySummary}>
                    {regulatory[0].summary}
                  </Text>
                </Section>
              </Section>
              <Hr style={styles.hr} />
            </>
          )}

          {/* ── Adoption Highlight ────────────────────────────────── */}
          {adoption && adoption.length > 0 && (
            <>
              <Section style={styles.section}>
                <Heading as="h2" style={styles.sectionHeading}>
                  Adoption Highlight
                </Heading>
                <Section style={styles.storyCardLast}>
                  <Text style={styles.storyMeta}>
                    <span style={{ color: colors.accent }}>{adoption[0].category}</span>
                    {"  "}
                    <span style={{ color: colors.textMuted }}>
                      {adoption[0].source}
                    </span>
                  </Text>
                  <Text style={styles.storyHeadline}>
                    {adoption[0].headline}
                  </Text>
                  <Text style={styles.storySummary}>
                    {adoption[0].summary}
                  </Text>
                </Section>
              </Section>
              <Hr style={styles.hr} />
            </>
          )}

          {/* ── CTA ────────────────────────────────────────────────── */}
          <Section style={styles.ctaSection}>
            <Text style={styles.ctaText}>
              Full briefing with institutional flows, macro context, expert insights, and more:
            </Text>
            <Link href={briefingUrl} style={styles.ctaButton}>
              Read Full Briefing
            </Link>
            <Text style={styles.ctaChatText}>
              Download today&apos;s 1-page summary:
            </Text>
            <Link href="%%PDF_URL%%" style={styles.ctaChatButton}>
              Download PDF Summary
            </Link>
            <Text style={styles.ctaChatText}>
              Or ask our AI about today&apos;s data:
            </Text>
            <Link href="%%CHAT_URL%%" style={styles.ctaChatButton}>
              Chat with AI
            </Link>
            <Text style={styles.communityText}>
              As a Pro subscriber, you have exclusive access to our AI assistant, daily PDF briefings, and deep-dive analysis.
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Footer ─────────────────────────────────────────────── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              AI-curated daily Bitcoin intelligence.
              <br />
              Data refreshed every day at 2 AM CET.
            </Text>
            <Text style={styles.footerLinks}>
              <Link href={siteUrl} style={styles.footerLink}>
                btctoday.co
              </Link>
              {" / "}
              <Link href={`${siteUrl}/archive`} style={styles.footerLink}>
                Archive
              </Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const fontStack = "Georgia, 'Times New Roman', serif";
const headingStack = "'Helvetica Neue', Helvetica, Arial, sans-serif";

const styles = {
  body: {
    backgroundColor: colors.bgBase,
    margin: "0",
    padding: "0",
    fontFamily: fontStack,
    color: colors.textPrimary,
    WebkitTextSizeAdjust: "100%" as const,
    MsTextSizeAdjust: "100%" as const,
  } as React.CSSProperties,

  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,

  header: {
    paddingTop: "32px",
    paddingBottom: "16px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  logo: {
    fontFamily: headingStack,
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    lineHeight: "1.2",
    margin: "0 0 4px",
    color: colors.textPrimary,
  } as React.CSSProperties,

  date: {
    fontSize: "13px",
    color: colors.textMuted,
    margin: "0",
    letterSpacing: "0.02em",
  } as React.CSSProperties,

  hr: {
    borderColor: colors.border,
    borderTopWidth: "1px",
    borderTopStyle: "solid" as const,
    margin: "0",
  } as React.CSSProperties,

  greeting: {
    fontFamily: headingStack,
    fontSize: "15px",
    fontWeight: "500",
    color: colors.textSecondary,
    margin: "0",
    lineHeight: "1.5",
  } as React.CSSProperties,

  diffBanner: {
    backgroundColor: colors.bgSurface,
    borderLeft: `4px solid ${colors.accent}`,
    padding: "14px 16px",
    margin: "16px 0",
    borderRadius: "8px",
  } as React.CSSProperties,

  diffPrice: {
    fontFamily: headingStack,
    fontSize: "18px",
    fontWeight: "700",
    color: colors.textPrimary,
    margin: "0 0 2px",
    lineHeight: "1.3",
  } as React.CSSProperties,

  diffNarrative: {
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "0",
    lineHeight: "1.5",
  } as React.CSSProperties,

  section: {
    padding: "20px 0",
  } as React.CSSProperties,

  sectionHeading: {
    fontFamily: headingStack,
    fontSize: "14px",
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 16px",
    lineHeight: "1.2",
  } as React.CSSProperties,

  priceHero: {
    backgroundColor: colors.bgSurface,
    borderRadius: "10px",
    border: `1px solid ${colors.border}`,
    padding: "16px",
    marginBottom: "10px",
  } as React.CSSProperties,

  priceLabel: {
    fontSize: "11px",
    fontFamily: headingStack,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 4px",
  } as React.CSSProperties,

  priceValue: {
    fontFamily: headingStack,
    fontSize: "30px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
    color: colors.textPrimary,
    margin: "0 0 4px",
    lineHeight: "1.2",
  } as React.CSSProperties,

  priceChanges: {
    fontSize: "14px",
    fontFamily: headingStack,
    fontWeight: "500",
    margin: "0",
    lineHeight: "1.4",
  } as React.CSSProperties,

  statCell: {
    backgroundColor: colors.bgElevated,
    borderRadius: "8px",
    border: `1px solid ${colors.border}`,
    padding: "12px",
    textAlign: "center" as const,
    width: "33.33%",
  } as React.CSSProperties,

  statLabel: {
    fontSize: "10px",
    fontFamily: headingStack,
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 4px",
  } as React.CSSProperties,

  statValue: {
    fontFamily: headingStack,
    fontSize: "16px",
    fontWeight: "700",
    color: colors.textPrimary,
    margin: "0",
    lineHeight: "1.3",
  } as React.CSSProperties,

  storyCard: {
    paddingBottom: "16px",
    marginBottom: "16px",
    borderBottom: `1px solid ${colors.border}`,
  } as React.CSSProperties,

  storyCardLast: {
    paddingBottom: "0",
    marginBottom: "0",
  } as React.CSSProperties,

  storyMeta: {
    fontSize: "12px",
    margin: "0 0 6px",
    lineHeight: "1.4",
  } as React.CSSProperties,

  storyHeadline: {
    fontFamily: headingStack,
    fontSize: "17px",
    fontWeight: "700",
    color: colors.textPrimary,
    textDecoration: "none",
    lineHeight: "1.35",
    display: "block" as const,
    marginBottom: "6px",
  } as React.CSSProperties,

  storySummary: {
    fontSize: "14px",
    color: colors.textSecondary,
    margin: "0",
    lineHeight: "1.6",
  } as React.CSSProperties,

  ctaSection: {
    textAlign: "center" as const,
    padding: "24px 0",
  } as React.CSSProperties,

  ctaText: {
    fontSize: "14px",
    color: colors.textSecondary,
    margin: "0 0 16px",
    lineHeight: "1.6",
  } as React.CSSProperties,

  ctaButton: {
    display: "inline-block" as const,
    backgroundColor: colors.accent,
    color: "#000000",
    fontFamily: headingStack,
    fontSize: "14px",
    fontWeight: "700",
    textDecoration: "none",
    padding: "12px 32px",
    borderRadius: "8px",
    letterSpacing: "0.01em",
  } as React.CSSProperties,

  ctaChatText: {
    fontSize: "13px",
    color: colors.textMuted,
    margin: "20px 0 12px",
    lineHeight: "1.6",
  } as React.CSSProperties,

  ctaChatButton: {
    display: "inline-block" as const,
    backgroundColor: "transparent",
    color: colors.accent,
    fontFamily: headingStack,
    fontSize: "13px",
    fontWeight: "600",
    textDecoration: "none",
    padding: "10px 28px",
    borderRadius: "8px",
    border: `1px solid ${colors.accent}`,
    letterSpacing: "0.01em",
  } as React.CSSProperties,

  footer: {
    textAlign: "center" as const,
    padding: "24px 0 32px",
  } as React.CSSProperties,

  footerText: {
    fontSize: "12px",
    color: colors.textMuted,
    margin: "0 0 8px",
    lineHeight: "1.6",
  } as React.CSSProperties,

  footerLinks: {
    fontSize: "12px",
    color: colors.textMuted,
    margin: "0",
  } as React.CSSProperties,

  footerLink: {
    color: colors.accent,
    textDecoration: "none",
    fontSize: "12px",
  } as React.CSSProperties,

  communityText: {
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "20px 0 0",
    lineHeight: "1.6",
    textAlign: "center" as const,
  } as React.CSSProperties,
} as const;
