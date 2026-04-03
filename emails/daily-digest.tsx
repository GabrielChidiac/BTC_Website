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

// ─── Palette ─────────────────────────────────────────────────────────────────
const c = {
  bgBase: "#F4F3F1",
  bgSurface: "#FFFFFF",
  bgElevated: "#F9F8F6",
  accent: "#F7931A",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#8A8A8A",
  border: "#E0DFDD",
  green: "#16A34A",
  red: "#DC2626",
  amber: "#D97706",
};

const serif = "Georgia, 'Times New Roman', serif";
const sans = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return pct >= 0 ? c.green : c.red;
}

function sentimentDot(sentiment: "bullish" | "bearish" | "neutral"): string {
  if (sentiment === "bullish") return "\u25B2";
  if (sentiment === "bearish") return "\u25BC";
  return "\u25CF";
}

function sentimentColor(sentiment: "bullish" | "bearish" | "neutral"): string {
  if (sentiment === "bullish") return c.green;
  if (sentiment === "bearish") return c.red;
  return c.textMuted;
}

function formatFlow(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}$${compactNumber(Math.abs(amount))}`;
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd() + "\u2026";
}

function isAvailable(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return !t.includes("unavailable") && !t.includes("no data") && t.length > 10;
}

function fgColor(v: number): string {
  if (v < 25) return c.red;
  if (v < 46) return c.amber;
  if (v < 55) return c.textMuted;
  return c.green;
}

function consColor(s: number): string {
  if (s > 15) return c.green;
  if (s < -15) return c.red;
  return c.textMuted;
}

function rsiColor(v: number): string {
  if (v < 30 || v > 70) return c.red;
  return c.green;
}

// ─── Micro-components ────────────────────────────────────────────────────────

function ProBadge() {
  return (
    <span
      style={{
        display: "inline-block",
        backgroundColor: c.accent,
        color: "#000",
        fontFamily: sans,
        fontSize: "8px",
        fontWeight: "700",
        letterSpacing: "0.08em",
        padding: "2px 5px",
        borderRadius: "3px",
        marginLeft: "6px",
        verticalAlign: "middle",
        textTransform: "uppercase" as const,
      }}
    >
      PRO
    </span>
  );
}

function StatTile({
  label,
  value,
  color,
  width = "33.33%",
}: {
  label: string;
  value: string;
  color?: string;
  width?: string;
}) {
  return (
    <Column
      style={{
        backgroundColor: c.bgElevated,
        borderRadius: "6px",
        border: `1px solid ${c.border}`,
        padding: "8px",
        textAlign: "center" as const,
        width,
      }}
    >
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={{ ...s.tileValue, ...(color ? { color } : {}) }}>{value}</Text>
    </Column>
  );
}

function DataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Text style={s.dataRow}>
      <span style={s.dataLabel}>{label}</span>
      <span style={{ ...s.dataValue, ...(color ? { color } : {}) }}>{value}</span>
    </Text>
  );
}

function ColHeading({ children }: { children: React.ReactNode }) {
  return (
    <Text style={s.colHeading}>{children}</Text>
  );
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface DailyDigestProps {
  briefing: BriefingJSON;
  siteUrl: string;
  name?: string;
}

// ─── Preview defaults ────────────────────────────────────────────────────────

const previewBriefing: BriefingJSON = {
  date: "2026-03-24",
  one_line: "ETF flows hit $420M, strongest since launch week.",
  top_stories: [
    { headline: "Bitcoin Surges Past $90K on Institutional Demand", source: "CoinDesk", url: "https://coindesk.com", summary: "Bitcoin rallied above $90,000 driven by renewed institutional buying and record ETF inflows. The surge came alongside favorable regulatory signals from the SEC.", sentiment: "bullish", tags: ["ETF", "institutional"] },
    { headline: "SEC Relaxes Crypto Custody Rules for Banks", source: "The Block", url: "https://theblock.co", summary: "New SEC guidance allows banks to custody crypto without special capital charges, removing a key barrier for institutional access.", sentiment: "bullish", tags: ["regulation", "custody"] },
    { headline: "Mining Difficulty Hits All-Time High", source: "Bitcoin Magazine", url: "https://bitcoinmagazine.com", summary: "Difficulty reached 95.67T, signaling strong miner commitment despite compressed margins as the halving approaches.", sentiment: "neutral", tags: ["mining", "halving"] },
  ],
  market_snapshot: { price_usd: 91247.53, change_24h_pct: 3.42, change_7d_pct: 8.91, market_cap_usd: 1_812_000_000_000, volume_24h_usd: 48_300_000_000, dominance_pct: 61.2, ath_usd: 125_000, ath_date: "2025-12-17T00:00:00Z" },
  technical_signals: { rsi_14: 62.4, sma_50: 84320, sma_200: 71580, support_level: 87500, resistance_level: 95000, signal_summary: "Price holds above the 200-day MA with RSI suggesting room to run before overheated territory." },
  btc_vs_everything: [
    { name: "S&P 500", ticker: "SPX", change_24h_pct: 0.45, change_ytd_pct: 8.2, change_1y_pct: 12.1, btc_relative_24h_pct: 2.97, btc_relative_ytd_pct: 41.8 },
    { name: "Gold", ticker: "XAU", change_24h_pct: -0.12, change_ytd_pct: 5.3, change_1y_pct: 18.4, btc_relative_24h_pct: 3.54, btc_relative_ytd_pct: 44.7 },
    { name: "DXY", ticker: "DXY", change_24h_pct: -0.31, change_ytd_pct: -2.1, change_1y_pct: -4.5, btc_relative_24h_pct: 3.73, btc_relative_ytd_pct: 52.1 },
  ],
  network_health: { hashrate_eh_s: 745.2, difficulty: 95_670_000_000_000, block_height: 892_140, mempool_tx_count: 32_451, mempool_size_mb: 18.7, fee_fast_sat_vb: 42, fee_medium_sat_vb: 18, fee_slow_sat_vb: 8, halving_progress_pct: 72.4, blocks_until_halving: 57_860 },
  daily_diff: { price_change: "+$3,012 (+3.42%)", sentiment_shift: "Institutional inflows drove sentiment higher", key_changes: ["ETF inflows surged", "SEC eased custody rules"] },
  countdown_events: [],
  looking_ahead: "Markets will watch for Friday's PCE inflation data and its impact on Fed rate expectations.",
  regulatory: [{ headline: "SEC Eases Crypto Custody Requirements for Banks", region: "US", summary: "New guidance allows banks to custody digital assets without punitive capital charges, removing the SAB 121 barrier for institutional custody.", impact: "positive", source: "The Block", url: "https://theblock.co" }],
  adoption: [{ headline: "Top-10 US Bank to Offer Bitcoin Custody", category: "institutional", summary: "Following relaxed SEC guidance, a major bank will offer Bitcoin custody to institutional clients by Q3 2026.", source: "CoinDesk", url: "https://coindesk.com" }],
  narrative_consensus: { score: 65, label: "Cautiously Optimistic", rationale: "Institutional positioning is net long with ETF inflows accelerating." },
  macro_context: { narrative: "The Fed held rates steady while global liquidity conditions eased. DXY weakness and expanding M2 provide a supportive backdrop for risk assets.", btc_correlation_note: "BTC decoupling from equities, trading more like a macro hedge against dollar debasement.", key_macro_events: ["FOMC meeting Mar 18-19", "PCE inflation Mar 28"] },
  institutional_flows: { etf_net_flow_usd: 420_000_000, etf_total_aum_usd: 115_000_000_000, etf_flow_trend: "5 consecutive days of net inflows totaling $1.8B", notable_moves: ["MicroStrategy purchased 12,000 BTC ($1.1B)"] },
  supply_dynamics: { exchange_reserve_trend: "Exchange reserves at 5-year low", long_term_holder_pct: 71.2, supply_narrative: "Only 3.125 BTC mined per block and 71% of supply hasn't moved in over a year — the tightest supply conditions since 2017." },
  expert_insights: [{ expert_name: "Lyn Alden", role: "Macro analyst", quote_or_summary: "Global liquidity expansion is the dominant driver right now. Bitcoin tends to perform well when M2 is expanding, and we're seeing that across all major economies.", source: "The Investors Podcast", date: "2026-03-22" }],
  fear_greed: { value: 72, label: "Greed" },
  etf_flows: { daily_net_flow_usd: 420_000_000, mtd_net_flow_usd: 3_200_000_000, total_net_assets_usd: 115_000_000_000 },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DailyDigest({
  briefing = previewBriefing,
  siteUrl = "https://btctoday.co",
  name,
}: DailyDigestProps) {
  const {
    market_snapshot: mkt,
    top_stories,
    daily_diff,
    regulatory,
    adoption,
    technical_signals: tech,
    network_health: net,
    btc_vs_everything,
    institutional_flows: flows,
    supply_dynamics: supply,
    expert_insights: experts,
    macro_context: macro,
    narrative_consensus: consensus,
    fear_greed: fg,
    etf_flows: etf,
    looking_ahead,
    countdown_events,
  } = briefing;

  const stories = top_stories.slice(0, 3);
  const briefingUrl = "%%BRIEFING_URL%%";
  const greeting = name ? `Good morning, ${name}.` : "Good morning.";
  const oneLine = briefing.one_line ?? daily_diff.sentiment_shift;
  const expert = experts?.[0];

  // Determine which sections have data
  const hasEtf = etf && (etf.daily_net_flow_usd != null || etf.mtd_net_flow_usd != null);
  const hasFlowTrend = isAvailable(flows?.etf_flow_trend);
  const hasMoves = flows?.notable_moves && flows.notable_moves.length > 0;
  const hasFlows = hasEtf || hasFlowTrend || hasMoves;
  const hasExpert = expert != null;
  const hasSupply = isAvailable(supply?.supply_narrative);
  const hasLooking = isAvailable(looking_ahead);
  const hasEvents = macro?.key_macro_events && macro.key_macro_events.length > 0;
  const hasCountdown = countdown_events && countdown_events.length > 0;
  const hasComparisons = btc_vs_everything && btc_vs_everything.length > 0;
  const hasReg = regulatory && regulatory.length > 0;
  const hasAdopt = adoption && adoption.length > 0;
  const hasSignals = hasReg || hasAdopt;

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font fontFamily="Georgia" fallbackFontFamily="serif" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>
        BTC {formatUSD(mkt.price_usd)} ({formatPct(mkt.change_24h_pct)})
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>

          {/* ── Header ──────────────────────────────────────── */}
          <Section style={s.header}>
            <Text style={s.logo}>
              BTC <span style={{ color: c.accent }}>Today</span>
            </Text>
            <Text style={s.date}>{formatDisplayDate(briefing.date)}</Text>
          </Section>

          <Hr style={s.hr} />

          {/* ── Greeting ────────────────────────────────────── */}
          <Section style={{ padding: "10px 0 0" }}>
            <Text style={s.greeting}>{greeting}</Text>
          </Section>

          {/* ── Price Banner ────────────────────────────────── */}
          <Section style={s.banner}>
            <Text style={s.bannerPrice}>{daily_diff.price_change}</Text>
            <Text style={s.bannerOneLine}>{oneLine}</Text>
            <Text style={s.bannerMeta}>
              {fg && (
                <>
                  <span style={{ color: c.textMuted }}>F&amp;G: </span>
                  <span style={{ fontWeight: "700", color: fgColor(fg.value) }}>
                    {fg.value} {fg.label}
                  </span>
                  <span style={{ color: c.textMuted }}> {"\u00B7"} </span>
                </>
              )}
              <span style={{ color: c.textMuted }}>Consensus: </span>
              <span style={{ fontWeight: "700", color: consColor(consensus.score) }}>
                {consensus.score > 0 ? "+" : ""}
                {consensus.score} {consensus.label}
              </span>
            </Text>
          </Section>

          {/* ── Market ──────────────────────────────────────── */}
          <Section style={s.section}>
            <Section style={s.priceHero}>
              <Text style={s.priceLabel}>Bitcoin</Text>
              <Text style={s.priceValue}>{formatUSD(mkt.price_usd)}</Text>
              <Text style={s.priceChanges}>
                <span style={{ color: pctColor(mkt.change_24h_pct) }}>
                  24h {formatPct(mkt.change_24h_pct)}
                </span>
                {"   "}
                <span style={{ color: pctColor(mkt.change_7d_pct) }}>
                  7d {formatPct(mkt.change_7d_pct)}
                </span>
              </Text>
            </Section>
            <Section style={{ padding: "0" }}>
              <Row>
                <StatTile label="Mkt Cap" value={`$${compactNumber(mkt.market_cap_usd)}`} />
                <StatTile label="Volume" value={`$${compactNumber(mkt.volume_24h_usd)}`} />
                <StatTile label="Dom" value={`${mkt.dominance_pct.toFixed(1)}%`} />
              </Row>
            </Section>
          </Section>

          <Hr style={s.hr} />

          {/* ── FLOWS + TECHNICALS (side-by-side) ───────────── */}
          {(hasFlows || true /* technicals always render */) && (
            <Section style={s.section}>
              <Row>
                {/* Left: FLOWS */}
                <Column style={s.panelLeft}>
                  <ColHeading>
                    FLOWS<ProBadge />
                  </ColHeading>
                  {hasEtf && etf && (
                    <>
                      {etf.daily_net_flow_usd != null && (
                        <DataRow
                          label="24h Flow"
                          value={formatFlow(etf.daily_net_flow_usd)}
                          color={pctColor(etf.daily_net_flow_usd)}
                        />
                      )}
                      {etf.mtd_net_flow_usd != null && (
                        <DataRow
                          label="MTD Flow"
                          value={formatFlow(etf.mtd_net_flow_usd)}
                          color={pctColor(etf.mtd_net_flow_usd)}
                        />
                      )}
                      {etf.total_net_assets_usd != null && (
                        <DataRow label="ETF AUM" value={`$${compactNumber(etf.total_net_assets_usd)}`} />
                      )}
                    </>
                  )}
                  {hasFlowTrend && (
                    <Text style={s.panelText}>{flows.etf_flow_trend}</Text>
                  )}
                  {hasMoves &&
                    flows.notable_moves.map((move, i) => (
                      <Text key={i} style={s.bullet}>
                        <span style={{ color: c.accent }}>{"\u2022"}</span> {move}
                      </Text>
                    ))}
                  {!hasFlows && (
                    <Text style={s.panelText}>ETF data updating shortly.</Text>
                  )}
                </Column>

                {/* Right: TECHNICALS */}
                <Column style={s.panelRight}>
                  <ColHeading>
                    TECHNICALS<ProBadge />
                  </ColHeading>
                  <DataRow label="RSI-14" value={tech.rsi_14.toFixed(1)} color={rsiColor(tech.rsi_14)} />
                  <DataRow label="SMA-50" value={formatUSD(tech.sma_50, 0)} />
                  <DataRow label="SMA-200" value={formatUSD(tech.sma_200, 0)} />
                  <DataRow label="Support" value={formatUSD(tech.support_level, 0)} />
                  <DataRow label="Resistance" value={formatUSD(tech.resistance_level, 0)} />
                  <Text style={s.panelItalic}>
                    {firstSentence(tech.signal_summary)}
                  </Text>
                </Column>
              </Row>
            </Section>
          )}

          <Hr style={s.hr} />

          {/* ── Stories ──────────────────────────────────────── */}
          {stories.length > 0 && (
            <Section style={s.section}>
              <Heading as="h2" style={s.sectionHeading}>Stories</Heading>
              {stories.map((story, i) => (
                <Section key={i} style={i < stories.length - 1 ? s.storyCard : s.storyCardLast}>
                  <Text style={s.storyMeta}>
                    <span style={{ color: sentimentColor(story.sentiment) }}>
                      {sentimentDot(story.sentiment)}
                    </span>
                    {"  "}
                    <span style={{ color: c.textMuted }}>{story.source}</span>
                    {story.tags.length > 0 && (
                      <span style={{ color: c.textMuted }}> {"\u00B7"} {story.tags[0]}</span>
                    )}
                  </Text>
                  <Link href={story.url} style={s.storyHeadline}>
                    {story.headline}
                  </Link>
                  <Text style={s.storySummary}>
                    {firstSentence(story.summary)}
                  </Text>
                </Section>
              ))}
            </Section>
          )}

          <Hr style={s.hr} />

          {/* ── ON-CHAIN + EXPERT (side-by-side) ────────────── */}
          <Section style={s.section}>
            <Row>
              {/* Left: ON-CHAIN */}
              <Column style={s.panelLeft}>
                <ColHeading>
                  ON-CHAIN<ProBadge />
                </ColHeading>
                <DataRow label="Hashrate" value={`${Math.round(net.hashrate_eh_s)} EH/s`} />
                <DataRow label="Halving" value={`${net.halving_progress_pct.toFixed(1)}%`} />
                <DataRow label="Fees" value={`${net.fee_fast_sat_vb}/${net.fee_medium_sat_vb}/${net.fee_slow_sat_vb}`} />
                {hasSupply && (
                  <Text style={s.panelText}>
                    {supply.long_term_holder_pct != null && (
                      <span style={{ fontWeight: "700" }}>{supply.long_term_holder_pct}% LTH</span>
                    )}
                    {supply.long_term_holder_pct != null && " \u00B7 "}
                    {firstSentence(supply.supply_narrative)}
                  </Text>
                )}
              </Column>

              {/* Right: EXPERT */}
              <Column style={s.panelRight}>
                <ColHeading>
                  EXPERT<ProBadge />
                </ColHeading>
                {hasExpert ? (
                  <>
                    <Text style={s.quoteText}>
                      &ldquo;{truncate(expert.quote_or_summary, 120)}&rdquo;
                    </Text>
                    <Text style={s.quoteAttrib}>
                      — {expert.expert_name}, {expert.role}
                    </Text>
                  </>
                ) : (
                  <Text style={s.panelText}>No expert commentary today.</Text>
                )}
              </Column>
            </Row>
          </Section>

          <Hr style={s.hr} />

          {/* ── Outlook ─────────────────────────────────────── */}
          <Section style={s.section}>
            <Heading as="h2" style={s.sectionHeading}>
              Outlook<ProBadge />
            </Heading>
            <Text style={s.outlineText}>
              {firstSentence(macro.narrative)}
            </Text>
            <Text style={s.outlineItalic}>
              {firstSentence(macro.btc_correlation_note)}
            </Text>
            {hasEvents && (
              <Text style={s.outlineText}>
                {macro.key_macro_events.map((e, i) => (
                  <span key={i}>
                    {i > 0 && " \u00B7 "}
                    <span style={{ color: c.accent }}>{"\u2022"}</span> {e}
                  </span>
                ))}
              </Text>
            )}
            {hasLooking && (
              <Text style={s.outlineText}>
                {firstSentence(looking_ahead)}
              </Text>
            )}
            {hasCountdown &&
              countdown_events.filter((e) => e.days_away != null).slice(0, 3).map((ev, i) => (
                <Text key={i} style={s.bullet}>
                  <span style={{ fontWeight: "700" }}>{ev.days_away}d</span> — {ev.name}
                </Text>
              ))}
          </Section>

          <Hr style={s.hr} />

          {/* ── VS Everything ───────────────────────────────── */}
          {hasComparisons && (
            <>
              <Section style={s.section}>
                <Heading as="h2" style={s.sectionHeading}>vs Everything</Heading>
                <Section style={{ padding: "0" }}>
                  <Row>
                    <StatTile
                      label="BTC 24h"
                      value={formatPct(mkt.change_24h_pct)}
                      color={pctColor(mkt.change_24h_pct)}
                      width="25%"
                    />
                    {btc_vs_everything.slice(0, 3).map((asset) => (
                      <StatTile
                        key={asset.ticker}
                        label={`${asset.ticker} YTD`}
                        value={asset.change_ytd_pct != null ? formatPct(asset.change_ytd_pct) : "N/A"}
                        color={asset.change_ytd_pct != null ? pctColor(asset.change_ytd_pct) : c.textMuted}
                        width="25%"
                      />
                    ))}
                  </Row>
                </Section>
              </Section>
              <Hr style={s.hr} />
            </>
          )}

          {/* ── Signals ─────────────────────────────────────── */}
          {hasSignals && (
            <>
              <Section style={s.section}>
                <Heading as="h2" style={s.sectionHeading}>Signals</Heading>
                {hasReg && (
                  <Text style={s.signalLine}>
                    <span style={{ color: c.accent, fontWeight: "600" }}>{regulatory[0].region}</span>
                    {" \u00B7 "}
                    {firstSentence(regulatory[0].summary)}
                  </Text>
                )}
                {hasAdopt && (
                  <Text style={s.signalLine}>
                    <span style={{ color: c.accent, fontWeight: "600" }}>{adoption[0].category}</span>
                    {" \u00B7 "}
                    {firstSentence(adoption[0].summary)}
                  </Text>
                )}
              </Section>
              <Hr style={s.hr} />
            </>
          )}

          {/* ── CTAs ────────────────────────────────────────── */}
          <Section style={s.ctaSection}>
            <Link href={briefingUrl} style={s.ctaButton}>
              Read Full Briefing
            </Link>
            <Text style={{ margin: "10px 0 0", fontSize: "0" }}>
              <Link href="%%PDF_URL%%" style={s.ctaSecondary}>
                Download PDF
              </Link>
              {"   "}
              <Link href="%%CHAT_URL%%" style={s.ctaSecondary}>
                Chat with AI
              </Link>
            </Text>
          </Section>

          <Hr style={s.hr} />

          {/* ── Footer ──────────────────────────────────────── */}
          <Section style={s.footer}>
            <Text style={s.footerText}>
              AI-curated daily Bitcoin intelligence. 2 AM CET.
            </Text>
            <Text style={s.footerLinks}>
              <Link href={siteUrl} style={s.footerLink}>btctoday.co</Link>
              {" \u00B7 "}
              <Link href={`${siteUrl}/archive`} style={s.footerLink}>Archive</Link>
              {" \u00B7 "}
              <Link href="%%UNSUBSCRIBE_URL%%" style={s.footerLink}>Unsubscribe</Link>
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = {
  body: {
    backgroundColor: c.bgBase,
    margin: "0",
    padding: "0",
    fontFamily: serif,
    color: c.textPrimary,
    WebkitTextSizeAdjust: "100%" as const,
    MsTextSizeAdjust: "100%" as const,
  } as React.CSSProperties,

  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "0 16px",
  } as React.CSSProperties,

  header: {
    paddingTop: "24px",
    paddingBottom: "12px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  logo: {
    fontFamily: sans,
    fontSize: "26px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    lineHeight: "1.2",
    margin: "0 0 2px",
    color: c.textPrimary,
  } as React.CSSProperties,

  date: {
    fontSize: "12px",
    color: c.textMuted,
    margin: "0",
    letterSpacing: "0.02em",
  } as React.CSSProperties,

  hr: {
    borderColor: c.border,
    borderTopWidth: "1px",
    borderTopStyle: "solid" as const,
    margin: "0",
  } as React.CSSProperties,

  greeting: {
    fontFamily: sans,
    fontSize: "14px",
    fontWeight: "500",
    color: c.textSecondary,
    margin: "0",
    lineHeight: "1.4",
  } as React.CSSProperties,

  // ── Banner ───────────────────────────────────
  banner: {
    backgroundColor: c.bgSurface,
    borderLeft: `4px solid ${c.accent}`,
    padding: "12px 14px",
    margin: "12px 0",
    borderRadius: "6px",
  } as React.CSSProperties,

  bannerPrice: {
    fontFamily: sans,
    fontSize: "18px",
    fontWeight: "700",
    color: c.textPrimary,
    margin: "0 0 2px",
    lineHeight: "1.3",
  } as React.CSSProperties,

  bannerOneLine: {
    fontSize: "13px",
    fontStyle: "italic" as const,
    color: c.textSecondary,
    margin: "4px 0 0",
    lineHeight: "1.4",
  } as React.CSSProperties,

  bannerMeta: {
    fontFamily: sans,
    fontSize: "11px",
    color: c.textMuted,
    margin: "6px 0 0",
    lineHeight: "1.4",
  } as React.CSSProperties,

  // ── Section ──────────────────────────────────
  section: {
    padding: "12px 0",
  } as React.CSSProperties,

  sectionHeading: {
    fontFamily: sans,
    fontSize: "12px",
    fontWeight: "600",
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 8px",
    lineHeight: "1.2",
  } as React.CSSProperties,

  // ── Price hero ───────────────────────────────
  priceHero: {
    backgroundColor: c.bgSurface,
    borderRadius: "8px",
    border: `1px solid ${c.border}`,
    padding: "12px",
    marginBottom: "8px",
  } as React.CSSProperties,

  priceLabel: {
    fontSize: "10px",
    fontFamily: sans,
    fontWeight: "600",
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 2px",
  } as React.CSSProperties,

  priceValue: {
    fontFamily: sans,
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "-0.02em",
    color: c.textPrimary,
    margin: "0 0 2px",
    lineHeight: "1.2",
  } as React.CSSProperties,

  priceChanges: {
    fontSize: "13px",
    fontFamily: sans,
    fontWeight: "500",
    margin: "0",
    lineHeight: "1.4",
  } as React.CSSProperties,

  // ── Stat tiles ───────────────────────────────
  tileLabel: {
    fontSize: "9px",
    fontFamily: sans,
    fontWeight: "600",
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 2px",
  } as React.CSSProperties,

  tileValue: {
    fontFamily: sans,
    fontSize: "14px",
    fontWeight: "700",
    color: c.textPrimary,
    margin: "0",
    lineHeight: "1.3",
  } as React.CSSProperties,

  // ── Two-column panels ────────────────────────
  panelLeft: {
    backgroundColor: c.bgElevated,
    border: `1px solid ${c.border}`,
    borderRadius: "6px",
    padding: "10px 12px",
    width: "50%",
    verticalAlign: "top" as const,
  } as React.CSSProperties,

  panelRight: {
    backgroundColor: c.bgElevated,
    border: `1px solid ${c.border}`,
    borderRadius: "6px",
    padding: "10px 12px",
    width: "50%",
    verticalAlign: "top" as const,
  } as React.CSSProperties,

  colHeading: {
    fontFamily: sans,
    fontSize: "11px",
    fontWeight: "700",
    color: c.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 8px",
    lineHeight: "1.2",
  } as React.CSSProperties,

  dataRow: {
    fontFamily: sans,
    fontSize: "12px",
    color: c.textPrimary,
    margin: "0 0 4px",
    lineHeight: "1.4",
  } as React.CSSProperties,

  dataLabel: {
    color: c.textMuted,
    fontWeight: "500" as const,
    display: "inline-block" as const,
    minWidth: "72px",
  },

  dataValue: {
    fontWeight: "700" as const,
    color: c.textPrimary,
  },

  panelText: {
    fontSize: "11px",
    color: c.textSecondary,
    margin: "6px 0 0",
    lineHeight: "1.5",
  } as React.CSSProperties,

  panelItalic: {
    fontSize: "11px",
    fontStyle: "italic" as const,
    color: c.textSecondary,
    margin: "6px 0 0",
    lineHeight: "1.5",
  } as React.CSSProperties,

  bullet: {
    fontSize: "11px",
    color: c.textSecondary,
    margin: "2px 0",
    lineHeight: "1.4",
    paddingLeft: "2px",
  } as React.CSSProperties,

  // ── Quote ────────────────────────────────────
  quoteText: {
    fontSize: "13px",
    fontFamily: serif,
    fontStyle: "italic" as const,
    color: c.textSecondary,
    margin: "0",
    lineHeight: "1.5",
  } as React.CSSProperties,

  quoteAttrib: {
    fontFamily: sans,
    fontSize: "11px",
    color: c.textMuted,
    margin: "4px 0 0",
    lineHeight: "1.3",
  } as React.CSSProperties,

  // ── Stories ──────────────────────────────────
  storyCard: {
    paddingBottom: "8px",
    marginBottom: "8px",
    borderBottom: `1px solid ${c.border}`,
  } as React.CSSProperties,

  storyCardLast: {
    paddingBottom: "0",
    marginBottom: "0",
  } as React.CSSProperties,

  storyMeta: {
    fontSize: "11px",
    margin: "0 0 4px",
    lineHeight: "1.4",
  } as React.CSSProperties,

  storyHeadline: {
    fontFamily: sans,
    fontSize: "15px",
    fontWeight: "700",
    color: c.textPrimary,
    textDecoration: "none",
    lineHeight: "1.3",
    display: "block" as const,
    marginBottom: "3px",
  } as React.CSSProperties,

  storySummary: {
    fontSize: "13px",
    color: c.textSecondary,
    margin: "0",
    lineHeight: "1.4",
  } as React.CSSProperties,

  // ── Outlook ──────────────────────────────────
  outlineText: {
    fontSize: "13px",
    color: c.textSecondary,
    margin: "0 0 4px",
    lineHeight: "1.5",
  } as React.CSSProperties,

  outlineItalic: {
    fontSize: "12px",
    fontStyle: "italic" as const,
    color: c.textMuted,
    margin: "0 0 4px",
    lineHeight: "1.5",
  } as React.CSSProperties,

  // ── Signals ──────────────────────────────────
  signalLine: {
    fontSize: "12px",
    color: c.textSecondary,
    margin: "0 0 4px",
    lineHeight: "1.5",
  } as React.CSSProperties,

  // ── CTA ──────────────────────────────────────
  ctaSection: {
    textAlign: "center" as const,
    padding: "14px 0",
  } as React.CSSProperties,

  ctaButton: {
    display: "inline-block" as const,
    backgroundColor: c.accent,
    color: "#000000",
    fontFamily: sans,
    fontSize: "13px",
    fontWeight: "700",
    textDecoration: "none",
    padding: "10px 28px",
    borderRadius: "6px",
    letterSpacing: "0.01em",
  } as React.CSSProperties,

  ctaSecondary: {
    display: "inline-block" as const,
    backgroundColor: "transparent",
    color: c.accent,
    fontFamily: sans,
    fontSize: "12px",
    fontWeight: "600",
    textDecoration: "none",
    padding: "8px 20px",
    borderRadius: "6px",
    border: `1px solid ${c.accent}`,
    letterSpacing: "0.01em",
  } as React.CSSProperties,

  // ── Footer ───────────────────────────────────
  footer: {
    textAlign: "center" as const,
    padding: "20px 0 24px",
  } as React.CSSProperties,

  footerText: {
    fontSize: "11px",
    color: c.textMuted,
    margin: "0 0 6px",
    lineHeight: "1.5",
  } as React.CSSProperties,

  footerLinks: {
    fontSize: "11px",
    color: c.textMuted,
    margin: "0",
  } as React.CSSProperties,

  footerLink: {
    color: c.accent,
    textDecoration: "none",
    fontSize: "11px",
  } as React.CSSProperties,
} as const;
