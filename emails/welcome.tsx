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

interface WelcomeEmailProps {
  email?: string;
  name?: string;
  siteUrl?: string;
}

export default function WelcomeEmail({
  email = "subscriber@example.com",
  name,
  siteUrl = "https://btctoday.co",
}: WelcomeEmailProps) {
  const greeting = name ? `Welcome, ${name}.` : "Welcome.";

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font fontFamily="Georgia" fallbackFontFamily="serif" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>Your free BTC Today account is live</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>

          {/* Header */}
          <Section style={styles.header}>
            <Img src={`${siteUrl}/logo.png`} width="120" height="144" alt="BTC Today" style={{ margin: "0 auto", width: "80px", height: "auto" }} />
          </Section>

          <Hr style={styles.hr} />

          {/* Main content */}
          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              {greeting}
            </Heading>

            <Text style={styles.bodyText}>
              You now have access to daily Bitcoin intelligence built for
              investors who value signal over noise. Every morning at 3 AM CET,
              a fresh briefing goes live on the site.
            </Text>

            <Text style={styles.bodyText}>
              Your free account includes market snapshots, the top stories
              of the day, BTC vs. traditional asset comparisons, and a
              weekly recap email every Sunday.
            </Text>

            <Text style={styles.bodyText}>
              Briefings are compiled from live market feeds, 7+ RSS sources,
              and multiple AI layers. No fluff, no filler.
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

          {/* Pro nudge - subtle, not a sales box */}
          <Section style={styles.content}>
            <Text style={styles.proText}>
              When you are ready for the full picture (daily email delivery,
              institutional flows, expert insights, AI chat, PDF downloads,
              and unlimited archive access),{" "}
              <Link href={`${siteUrl}/pricing`} style={styles.proLink}>
                Pro is here
              </Link>.
            </Text>
          </Section>

          <Hr style={styles.hr} />

          {/* Footer */}
          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Sent to{" "}
              <span style={{ color: colors.textSecondary }}>{email}</span>
              {" "}because you signed up for BTC Today.
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

  proText: {
    fontSize: "14px",
    color: colors.textMuted,
    margin: "0",
    lineHeight: "1.7",
  } as React.CSSProperties,

  proLink: {
    color: colors.accent,
    textDecoration: "none",
    fontWeight: "600",
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
