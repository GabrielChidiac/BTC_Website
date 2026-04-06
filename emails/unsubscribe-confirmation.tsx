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

const colors = {
  bgBase: "#F4F3F1",
  bgSurface: "#FFFFFF",
  accent: "#F7931A",
  textPrimary: "#1A1A1A",
  textSecondary: "#4A4A4A",
  textMuted: "#8A8A8A",
  border: "#E0DFDD",
};

interface UnsubscribeConfirmationEmailProps {
  email?: string;
  name?: string;
  siteUrl?: string;
}

export default function UnsubscribeConfirmationEmail({
  email = "subscriber@example.com",
  name,
  siteUrl = "https://btctoday.co",
}: UnsubscribeConfirmationEmailProps) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font fontFamily="Georgia" fallbackFontFamily="serif" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>You&apos;ve been unsubscribed from BTC Today</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img src={`${siteUrl}/logo.png`} width="120" height="144" alt="BTC Today" style={{ margin: "0 auto", width: "80px", height: "auto" }} />
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              You&apos;ve been unsubscribed
            </Heading>

            <Text style={styles.bodyText}>
              {greeting} This confirms that{" "}
              <strong style={{ color: colors.textPrimary }}>{email}</strong> has
              been removed from all BTC Today emails. You will no longer receive
              daily briefings or weekly recaps.
            </Text>

            <Section style={styles.highlightBox}>
              <Text style={styles.highlightText}>
                Changed your mind? You can re-subscribe at any time by visiting{" "}
                <Link
                  href={siteUrl}
                  style={{
                    color: colors.accent,
                    textDecoration: "none",
                    fontWeight: "700",
                  }}
                >
                  btctoday.co
                </Link>
                .
              </Text>
            </Section>

            <Text style={styles.bodyText}>
              If you have any feedback on how we could improve, we&apos;d love to hear
              from you at{" "}
              <Link
                href="mailto:hello@btctoday.co"
                style={{ color: colors.accent, textDecoration: "none" }}
              >
                hello@btctoday.co
              </Link>
              .
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              This is a one-time confirmation. You will not receive further
              emails from BTC Today.
            </Text>
            <Text style={styles.footerLinks}>
              <Link href={siteUrl} style={styles.footerLink}>
                btctoday.co
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

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

  highlightText: {
    fontSize: "14px",
    color: colors.textSecondary,
    margin: "0",
    lineHeight: "1.7",
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
