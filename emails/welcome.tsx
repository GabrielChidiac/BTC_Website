import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Link,
  Hr,
  Font,
} from "@react-email/components";

// ─── Palette (light / platinum theme) ────────────────────────────────────────
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
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface WelcomeEmailProps {
  email?: string;
  name?: string;
  siteUrl?: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WelcomeEmail({
  email = "subscriber@example.com",
  name,
  siteUrl = "https://btctoday.co",
}: WelcomeEmailProps) {
  const greeting = name ? `You're in, ${name}.` : "You're in.";
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font fontFamily="Georgia" fallbackFontFamily="serif" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>You're in — daily Bitcoin intelligence starts tomorrow at 2 AM CET</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <Section style={styles.header}>
            <Text style={styles.logo}>
              BTC <span style={{ color: colors.accent }}>Today</span>
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Welcome Message ─────────────────────────────────────── */}
          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              {greeting}
            </Heading>

            <Text style={styles.bodyText}>
              Welcome to BTC Today. Daily Bitcoin intelligence
              for investors who don&apos;t have time to wade through noise.
            </Text>

            <Section style={styles.highlightBox}>
              <Text style={styles.highlightLabel}>What you&apos;ll get</Text>
              <Text style={styles.highlightText}>
                Every morning at <strong style={{ color: colors.textPrimary }}>2 AM CET</strong>,
                a single email with everything that matters: market moves, top stories,
                institutional flows, macro context, and expert insights — no filler.
              </Text>
            </Section>

            <Text style={styles.bodyText}>
              Each briefing is built from 7 RSS feeds, live market data,
              and enriched through multiple AI layers. We distill it so you
              don&apos;t have to.
            </Text>

            <Section style={styles.expectList}>
              <Text style={styles.expectItem}>
                <span style={{ color: colors.accent }}>&#9656;</span>
                {"  "}Market snapshot with price, volume, and dominance
              </Text>
              <Text style={styles.expectItem}>
                <span style={{ color: colors.accent }}>&#9656;</span>
                {"  "}Top 3 stories with sentiment analysis
              </Text>
              <Text style={styles.expectItem}>
                <span style={{ color: colors.accent }}>&#9656;</span>
                {"  "}Institutional flows and ETF data
              </Text>
              <Text style={styles.expectItem}>
                <span style={{ color: colors.accent }}>&#9656;</span>
                {"  "}Technical signals (RSI, SMAs, support/resistance)
              </Text>
              <Text style={styles.expectItem}>
                <span style={{ color: colors.accent }}>&#9656;</span>
                {"  "}Expert insights from recognized analysts
              </Text>
              <Text style={styles.expectItem}>
                <span style={{ color: colors.accent }}>&#9656;</span>
                {"  "}AI chat access to ask questions about the data
              </Text>
            </Section>
          </Section>

          <Hr style={styles.hr} />

          {/* ── CTA ────────────────────────────────────────────────── */}
          <Section style={styles.ctaSection}>
            <Text style={styles.ctaText}>
              Your first briefing arrives tomorrow. In the meantime:
            </Text>
            <Link href="https://btctoday.co" style={styles.ctaButton}>
              Read Today&apos;s Briefing
            </Link>
          </Section>

          <Hr style={styles.hr} />

          {/* ── Footer ─────────────────────────────────────────────── */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This email was sent to{" "}
              <span style={{ color: colors.textSecondary }}>{email}</span>
              {" "}because you subscribed to BTC Today.
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

// ─── Styles ──────────────────────────────────────────────────────────────────

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
    margin: "0",
    color: colors.textPrimary,
  } as React.CSSProperties,

  hr: {
    borderColor: colors.border,
    borderTopWidth: "1px",
    borderTopStyle: "solid" as const,
    margin: "0",
  } as React.CSSProperties,

  content: {
    padding: "32px 0 24px",
  } as React.CSSProperties,

  heading: {
    fontFamily: headingStack,
    fontSize: "32px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    lineHeight: "1.2",
    color: colors.textPrimary,
    margin: "0 0 16px",
  } as React.CSSProperties,

  bodyText: {
    fontSize: "15px",
    color: colors.textSecondary,
    margin: "0 0 20px",
    lineHeight: "1.7",
  } as React.CSSProperties,

  highlightBox: {
    backgroundColor: colors.bgSurface,
    borderLeft: `4px solid ${colors.accent}`,
    padding: "16px 18px",
    margin: "0 0 20px",
    borderRadius: "8px",
  } as React.CSSProperties,

  highlightLabel: {
    fontFamily: headingStack,
    fontSize: "11px",
    fontWeight: "600",
    color: colors.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    margin: "0 0 8px",
  } as React.CSSProperties,

  highlightText: {
    fontSize: "14px",
    color: colors.textSecondary,
    margin: "0",
    lineHeight: "1.7",
  } as React.CSSProperties,

  expectList: {
    padding: "0",
    margin: "0 0 8px",
  } as React.CSSProperties,

  expectItem: {
    fontFamily: headingStack,
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "0 0 8px",
    lineHeight: "1.5",
    paddingLeft: "4px",
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
