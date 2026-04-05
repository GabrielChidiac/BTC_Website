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
import type { WeeklyRecapData } from "../src/lib/types";

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

function formatUSD(amount: number, decimals = 0): string {
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

function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const num = d.getUTCDate();
  return `${day} ${num}`;
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  const sMonth = s.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const eMonth = e.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const sDay = s.getUTCDate();
  const eDay = e.getUTCDate();
  const year = e.getUTCFullYear();
  if (sMonth === eMonth) {
    return `${sMonth} ${sDay}\u2013${eDay}, ${year}`;
  }
  return `${sMonth} ${sDay} \u2013 ${eMonth} ${eDay}, ${year}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface WeeklyRecapProps {
  recap: WeeklyRecapData;
  siteUrl: string;
  name?: string;
}

// ─── Preview defaults for React Email dev server ──────────────────────────────

const previewRecap: WeeklyRecapData = {
  week_start: "2026-03-24",
  week_end: "2026-03-30",
  days_available: 7,
  price_start: 88235,
  price_end: 91247,
  price_change_pct: 3.42,
  price_high: 94500,
  price_low: 87900,
  btc_7d_change_pct: 3.42,
  daily_summaries: [
    { date: "2026-03-24", price_usd: 88235, change_24h_pct: -1.2, consensus_label: "Cautious", consensus_score: 35, one_line: null },
    { date: "2026-03-25", price_usd: 89100, change_24h_pct: 0.98, consensus_label: "Neutral", consensus_score: 50, one_line: null },
    { date: "2026-03-26", price_usd: 90500, change_24h_pct: 1.57, consensus_label: "Optimistic", consensus_score: 62, one_line: null },
    { date: "2026-03-27", price_usd: 89800, change_24h_pct: -0.77, consensus_label: "Cautious", consensus_score: 40, one_line: null },
    { date: "2026-03-28", price_usd: 91200, change_24h_pct: 1.56, consensus_label: "Optimistic", consensus_score: 65, one_line: null },
    { date: "2026-03-29", price_usd: 94500, change_24h_pct: 3.62, consensus_label: "Bullish", consensus_score: 75, one_line: null },
    { date: "2026-03-30", price_usd: 91247, change_24h_pct: -3.44, consensus_label: "Cautiously Optimistic", consensus_score: 65, one_line: "Institutional inflows sustain momentum despite weekend pullback." },
  ],
  top_stories: [
    { headline: "Bitcoin Surges Past $90K on Institutional Demand", source: "CoinDesk", url: "https://coindesk.com", summary: "Bitcoin rallied above $90,000 driven by renewed institutional buying and record ETF inflows.", sentiment: "bullish", date: "2026-03-24" },
    { headline: "SEC Relaxes Crypto Custody Rules for Banks", source: "The Block", url: "https://theblock.co", summary: "New SEC guidance allows banks to custody crypto without special capital charges.", sentiment: "bullish", date: "2026-03-25" },
    { headline: "Mining Difficulty Hits All-Time High", source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com", summary: "Difficulty reached 95.67T, signaling strong miner commitment despite compressed margins.", sentiment: "neutral", date: "2026-03-26" },
    { headline: "Japan's Largest Bank to Offer Bitcoin Custody", source: "Reuters", url: "https://reuters.com", summary: "MUFG will offer Bitcoin custody to institutional clients following regulatory clarity.", sentiment: "bullish", date: "2026-03-28" },
    { headline: "Weekend Profit-Taking Pulls BTC Below $92K", source: "Bloomberg", url: "https://bloomberg.com", summary: "Short-term holders took profits after a 6% weekly rally, pushing prices back from the week's highs.", sentiment: "bearish", date: "2026-03-30" },
  ],
  regulatory_highlights: [
    { headline: "SEC Eases Crypto Custody Requirements for Banks", region: "US", summary: "New guidance allows banks to custody digital assets without punitive capital charges.", impact: "positive" },
  ],
  adoption_highlights: [
    { headline: "Top-10 US Bank to Offer Bitcoin Custody", category: "institutional", summary: "Following relaxed SEC guidance, a major bank will offer Bitcoin custody to institutional clients." },
  ],
  btc_vs_everything: [
    { name: "S&P 500", ticker: "SPX", change_ytd_pct: 8.2 },
    { name: "Gold", ticker: "XAU", change_ytd_pct: 5.3 },
    { name: "DXY", ticker: "DXY", change_ytd_pct: -2.1 },
  ],
  market_cap_end: 1_812_000_000_000,
  volume_avg: 48_300_000_000,
  dominance_end: 61.2,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WeeklyRecap({
  recap = previewRecap,
  siteUrl = "https://btctoday.co",
  name,
}: WeeklyRecapProps) {
  const {
    daily_summaries,
    top_stories,
    regulatory_highlights,
    adoption_highlights,
    btc_vs_everything,
  } = recap;

  const briefingUrl = "%%BRIEFING_URL%%";
  const greeting = name ? `Good morning, ${name}.` : "Good morning.";
  const dateRange = formatDateRange(recap.week_start, recap.week_end);
  const lastDay = daily_summaries[daily_summaries.length - 1];
  const lastOneLine = lastDay?.one_line;

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
        BTC Week: {formatUSD(recap.price_end)} ({formatPct(recap.price_change_pct)})
      </Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logo}>
              BTC <span style={{ color: colors.accent }}>Today</span>
            </Text>
            <Text style={styles.subtitle}>Week in Review</Text>
            <Text style={styles.date}>{dateRange}</Text>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Greeting ─────────────────────────────────────────────── */}
          <Section style={{ padding: "16px 0 0" }}>
            <Text style={styles.greeting}>{greeting}</Text>
          </Section>

          {/* ── Week at a Glance Banner ────────────────────────────── */}
          <Section style={styles.diffBanner}>
            <Text style={styles.diffPrice}>
              {formatUSD(recap.price_start)} {"\u2192"}{" "}
              <span style={{ color: pctColor(recap.price_change_pct) }}>
                {formatUSD(recap.price_end)} ({formatPct(recap.price_change_pct)})
              </span>
            </Text>
            <Text style={styles.diffNarrative}>
              High {formatUSD(recap.price_high)} {"\u00B7"} Low {formatUSD(recap.price_low)}
            </Text>
            {lastOneLine && (
              <Text style={styles.diffOneLine}>{lastOneLine}</Text>
            )}
          </Section>

          {/* ── Daily Price Tracker ────────────────────────────────── */}
          <Section style={styles.section}>
            <Heading as="h2" style={styles.sectionHeading}>
              Daily Recap
            </Heading>
            {daily_summaries.map((day, i) => (
              <Text
                key={day.date}
                style={i < daily_summaries.length - 1 ? styles.dayRow : styles.dayRowLast}
              >
                <span style={styles.dayDate}>{formatShortDate(day.date)}</span>
                {"  \u2014  "}
                <span style={styles.dayPrice}>{formatUSD(day.price_usd)}</span>
                {"  "}
                <span style={{ color: pctColor(day.change_24h_pct), fontWeight: "600" }}>
                  ({formatPct(day.change_24h_pct)})
                </span>
                {"  \u00B7  "}
                <span style={{ color: colors.textMuted }}>{day.consensus_label}</span>
              </Text>
            ))}
          </Section>

          <Hr style={styles.hr} />

          {/* ── Market Stats ────────────────────────────────────────── */}
          <Section style={styles.section}>
            <Heading as="h2" style={styles.sectionHeading}>
              Market Stats
            </Heading>
            <Section style={{ padding: "0" }}>
              <Row>
                <Column style={styles.statCell}>
                  <Text style={styles.statLabel}>Market Cap</Text>
                  <Text style={styles.statValue}>${compactNumber(recap.market_cap_end)}</Text>
                </Column>
                <Column style={styles.statCell}>
                  <Text style={styles.statLabel}>Avg Volume</Text>
                  <Text style={styles.statValue}>${compactNumber(recap.volume_avg)}</Text>
                </Column>
                <Column style={styles.statCell}>
                  <Text style={styles.statLabel}>Dominance</Text>
                  <Text style={styles.statValue}>{recap.dominance_end.toFixed(1)}%</Text>
                </Column>
              </Row>
            </Section>
          </Section>


          <Hr style={styles.hr} />

          {/* ── Top Stories This Week ───────────────────────────────── */}
          {top_stories.length > 0 && (
            <Section style={styles.section}>
              <Heading as="h2" style={styles.sectionHeading}>
                Top Stories This Week
              </Heading>
              {top_stories.map((story, i) => (
                <Section key={i} style={i < top_stories.length - 1 ? styles.storyCard : styles.storyCardLast}>
                  <Text style={styles.storyMeta}>
                    <span style={{ color: sentimentColor(story.sentiment) }}>
                      {sentimentDot(story.sentiment)}
                    </span>
                    {"  "}
                    <span style={{ color: colors.textMuted }}>
                      {story.source} {"\u00B7"} {formatShortDate(story.date)}
                    </span>
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
          )}

          <Hr style={styles.hr} />

          {/* ── BTC vs Everything ───────────────────────────────────── */}
          {btc_vs_everything.length > 0 && (
            <>
              <Section style={styles.section}>
                <Heading as="h2" style={styles.sectionHeading}>
                  BTC vs Everything
                </Heading>
                <Section style={{ padding: "0" }}>
                  <Row>
                    <Column style={styles.statCell}>
                      <Text style={styles.statLabel}>BTC 7d</Text>
                      <Text style={{ ...styles.statValue, color: pctColor(recap.btc_7d_change_pct) }}>
                        {formatPct(recap.btc_7d_change_pct)}
                      </Text>
                    </Column>
                    {btc_vs_everything.slice(0, 3).map((asset) => (
                      <Column key={asset.ticker} style={styles.statCell}>
                        <Text style={styles.statLabel}>{asset.ticker} YTD</Text>
                        <Text style={{ ...styles.statValue, color: asset.change_ytd_pct != null ? pctColor(asset.change_ytd_pct) : colors.textMuted }}>
                          {asset.change_ytd_pct != null ? formatPct(asset.change_ytd_pct) : "N/A"}
                        </Text>
                      </Column>
                    ))}
                  </Row>
                </Section>
              </Section>
              <Hr style={styles.hr} />
            </>
          )}

          {/* ── Regulatory Highlights ──────────────────────────────── */}
          {regulatory_highlights.length > 0 && (
            <>
              <Section style={styles.section}>
                <Heading as="h2" style={styles.sectionHeading}>
                  Regulatory Spotlight
                </Heading>
                {regulatory_highlights.map((item, i) => (
                  <Section key={i} style={i < regulatory_highlights.length - 1 ? styles.storyCard : styles.storyCardLast}>
                    <Text style={styles.storyMeta}>
                      <span style={{ color: colors.accent }}>{item.region}</span>
                      {"  "}
                      <span style={{ color: item.impact === "positive" ? colors.green : item.impact === "negative" ? colors.red : colors.textMuted }}>
                        {item.impact === "positive" ? "\u25B2" : item.impact === "negative" ? "\u25BC" : "\u25CF"}
                      </span>
                    </Text>
                    <Text style={styles.storyHeadline}>{item.headline}</Text>
                    <Text style={styles.storySummary}>{item.summary}</Text>
                  </Section>
                ))}
              </Section>
              <Hr style={styles.hr} />
            </>
          )}

          {/* ── Adoption Highlights ────────────────────────────────── */}
          {adoption_highlights.length > 0 && (
            <>
              <Section style={styles.section}>
                <Heading as="h2" style={styles.sectionHeading}>
                  Adoption Highlight
                </Heading>
                {adoption_highlights.map((item, i) => (
                  <Section key={i} style={i < adoption_highlights.length - 1 ? styles.storyCard : styles.storyCardLast}>
                    <Text style={styles.storyMeta}>
                      <span style={{ color: colors.accent }}>{item.category}</span>
                    </Text>
                    <Text style={styles.storyHeadline}>{item.headline}</Text>
                    <Text style={styles.storySummary}>{item.summary}</Text>
                  </Section>
                ))}
              </Section>
              <Hr style={styles.hr} />
            </>
          )}

          {/* ── CTA ────────────────────────────────────────────────── */}
          <Section style={styles.ctaSection}>
            <Text style={styles.ctaText}>
              Read the full briefing with today&apos;s market data, stories, and analysis:
            </Text>
            <Link href={briefingUrl} style={styles.ctaButton}>
              Read the Latest Briefing
            </Link>
            <Text style={styles.ctaChatText}>
              Want the full picture?
            </Text>
            <Link href={`${siteUrl}/pricing`} style={styles.ctaChatButton}>
              Go Pro — $59/year
            </Link>
            <Text style={styles.proText}>
              Pro subscribers get the full briefing delivered to their inbox every morning,
              plus institutional flows, expert insights, AI chat, and PDF summaries.
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Footer ─────────────────────────────────────────────── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              AI-curated daily Bitcoin intelligence.
              <br />
              Weekly recap sent every Sunday at 10 AM CET.
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
            <Text style={styles.footerText}>
              <Link href="%%UNSUBSCRIBE_URL%%" style={styles.footerLink}>
                Unsubscribe
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

  subtitle: {
    fontFamily: headingStack,
    fontSize: "12px",
    fontWeight: "600",
    color: colors.accent,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    margin: "0 0 4px",
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
    fontSize: "17px",
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

  diffOneLine: {
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "8px 0 0",
    lineHeight: "1.5",
    fontStyle: "italic" as const,
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

  dayRow: {
    fontFamily: headingStack,
    fontSize: "13px",
    color: colors.textPrimary,
    margin: "0 0 8px",
    lineHeight: "1.5",
    paddingBottom: "8px",
    borderBottom: `1px solid ${colors.border}`,
  } as React.CSSProperties,

  dayRowLast: {
    fontFamily: headingStack,
    fontSize: "13px",
    color: colors.textPrimary,
    margin: "0",
    lineHeight: "1.5",
  } as React.CSSProperties,

  dayDate: {
    fontWeight: "600" as const,
    color: colors.textPrimary,
    minWidth: "48px",
    display: "inline-block" as const,
  },

  dayPrice: {
    fontWeight: "700" as const,
    color: colors.textPrimary,
  },

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

  proText: {
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "20px 0 0",
    lineHeight: "1.6",
    textAlign: "center" as const,
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
} as const;
