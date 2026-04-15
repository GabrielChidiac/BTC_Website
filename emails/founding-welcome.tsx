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
  Img,
} from "@react-email/components";

// Palette - light / platinum theme (matches site)
const colors = {
  bgBase: "#F4F3F1",
  bgSurface: "#FFFFFF",
  accent: "#F7931A",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#8A8A8A",
  border: "#E0DFDD",
};

interface FoundingWelcomeEmailProps {
  email?: string;
  name?: string;
  siteUrl?: string;
}

export default function FoundingWelcomeEmail({
  email = "subscriber@example.com",
  name,
  siteUrl = "https://btctoday.co",
}: FoundingWelcomeEmailProps) {
  const greeting = name
    ? `${name}, you're a Founding Member.`
    : "You're a Founding Member.";

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font fontFamily="Georgia" fallbackFontFamily="serif" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>You're one of our first 100. Full Pro access is yours</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Header */}
          <Section style={styles.header}>
            <Img src={`${siteUrl}/logo.png`} width="120" height="144" alt="BTC Today" style={{ margin: "0 auto 8px", width: "80px", height: "auto" }} />
            <Text style={styles.logo}>
              <span style={styles.badge}>FOUNDING MEMBER</span>
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* Main content */}
          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              {greeting}
            </Heading>

            <Text style={styles.bodyText}>
              You joined BTC Today early, and that means something. As one
              of our first 100 subscribers, you have full Pro access, on
              the house, permanently.
            </Text>

            <Text style={styles.bodyText}>
              Every morning at 3 AM CET, you will receive a comprehensive
              briefing directly in your inbox. No need to visit the site
              unless you want to.
            </Text>

            <Section style={styles.benefitSection}>
              <Text style={styles.benefitItem}>
                <span style={styles.bullet}>01</span>
                Daily briefing delivered to your inbox
              </Text>
              <Text style={styles.benefitItem}>
                <span style={styles.bullet}>02</span>
                Regulatory moves and policy developments
              </Text>
              <Text style={styles.benefitItem}>
                <span style={styles.bullet}>03</span>
                ETF flows, institutional activity, and whale movements
              </Text>
              <Text style={styles.benefitItem}>
                <span style={styles.bullet}>04</span>
                Technical signals, network health, and on-chain data
              </Text>
              <Text style={styles.benefitItem}>
                <span style={styles.bullet}>05</span>
                Expert insights and forward outlook
              </Text>
              <Text style={styles.benefitItem}>
                <span style={styles.bullet}>06</span>
                PDF downloads and full archive access
              </Text>
            </Section>

            <Text style={styles.bodyText}>
              This is yours to keep. When we open paid subscriptions,
              your access stays the same. No action needed.
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* CTA */}
          <Section style={styles.ctaSection}>
            <Link href={siteUrl} style={styles.ctaButton}>
              Read Today&apos;s Briefing
            </Link>
          </Section>

          <Hr style={styles.hr} />

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Sent to{" "}
              <span style={{ color: colors.textSecondary }}>{email}</span>
              {" "}because you joined BTC Today as a founding member.
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

// Styles
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
    maxWidth: "560px",
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
    fontSize: "24px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    lineHeight: "1.2",
    margin: "0",
    color: colors.textPrimary,
  } as React.CSSProperties,

  badge: {
    fontFamily: headingStack,
    fontSize: "8px",
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: "0.1em",
    marginLeft: "8px",
    verticalAlign: "super",
  } as React.CSSProperties,

  hr: {
    borderColor: colors.border,
    borderTopWidth: "1px",
    borderTopStyle: "solid" as const,
    margin: "0",
  } as React.CSSProperties,

  content: {
    padding: "28px 0 20px",
  } as React.CSSProperties,

  heading: {
    fontFamily: headingStack,
    fontSize: "28px",
    fontWeight: "700",
    letterSpacing: "-0.03em",
    lineHeight: "1.2",
    color: colors.textPrimary,
    margin: "0 0 16px",
  } as React.CSSProperties,

  bodyText: {
    fontSize: "15px",
    color: colors.textSecondary,
    margin: "0 0 16px",
    lineHeight: "1.7",
  } as React.CSSProperties,

  benefitSection: {
    padding: "8px 0 8px",
    margin: "0 0 8px",
  } as React.CSSProperties,

  benefitItem: {
    fontFamily: headingStack,
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "0 0 10px",
    lineHeight: "1.5",
    paddingLeft: "4px",
  } as React.CSSProperties,

  bullet: {
    fontFamily: headingStack,
    fontSize: "10px",
    fontWeight: "700",
    color: colors.accent,
    letterSpacing: "0.05em",
    marginRight: "10px",
  } as React.CSSProperties,

  ctaSection: {
    textAlign: "center" as const,
    padding: "24px 0",
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
