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

interface TipReceiptEmailProps {
  email?: string;
  amountUsd?: string;
  tipperName?: string | null;
  briefingDate?: string | null;
  paidAt?: string;
  siteUrl?: string;
}

export default function TipReceiptEmail({
  email = "supporter@example.com",
  amountUsd = "$21.00",
  tipperName,
  briefingDate,
  paidAt = new Date().toISOString(),
  siteUrl = "https://btctoday.co",
}: TipReceiptEmailProps) {
  const greeting = tipperName ? `Thank you, ${tipperName}.` : "Thank you.";
  const paidDate = new Date(paidAt).toUTCString();

  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font fontFamily="Georgia" fallbackFontFamily="serif" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>Tip received: {amountUsd}. The brief continues.</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img
              src={`${siteUrl}/logo.png`}
              width="80"
              height="96"
              alt="BTC Today"
              style={{ margin: "0 auto", width: "80px", height: "auto" }}
            />
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              {greeting}
            </Heading>

            <Text style={styles.bodyText}>
              We received your tip of <strong>{amountUsd}</strong>. This email
              is your BTC Today record of the payment. Stripe will also send a
              standard card receipt for your records.
            </Text>

            {briefingDate && (
              <Text style={styles.bodyText}>
                Tip referenced the briefing from{" "}
                <strong>{briefingDate}</strong>.
              </Text>
            )}
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.detailSection}>
            <Text style={styles.detailRow}>
              <span style={styles.detailLabel}>Amount</span>
              <span style={styles.detailValue}>{amountUsd}</span>
            </Text>
            <Text style={styles.detailRow}>
              <span style={styles.detailLabel}>Paid</span>
              <span style={styles.detailValue}>{paidDate}</span>
            </Text>
            <Text style={styles.detailRow}>
              <span style={styles.detailLabel}>Statement</span>
              <span style={styles.detailValue}>BTC TODAY TIP</span>
            </Text>
            <Text style={styles.detailRow}>
              <span style={styles.detailLabel}>Email</span>
              <span style={styles.detailValue}>{email}</span>
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.ctaSection}>
            <Link href={siteUrl} style={styles.ctaButton}>
              Read today&apos;s brief
            </Link>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              Questions? Reply to this email or write{" "}
              <Link href="mailto:hello@btctoday.co" style={styles.footerLink}>
                hello@btctoday.co
              </Link>
              .
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

  detailSection: {
    padding: "20px 0",
  } as React.CSSProperties,

  detailRow: {
    fontSize: "13px",
    color: colors.textSecondary,
    margin: "0 0 6px",
    lineHeight: "1.6",
    display: "block",
  } as React.CSSProperties,

  detailLabel: {
    display: "inline-block",
    width: "90px",
    color: colors.textMuted,
    fontFamily: headingStack,
    fontSize: "11px",
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
  } as React.CSSProperties,

  detailValue: {
    color: colors.textPrimary,
    fontFamily: headingStack,
    fontSize: "13px",
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
