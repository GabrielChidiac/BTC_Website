import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
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

interface VerificationEmailProps {
  code?: string;
  name?: string;
}

export default function VerificationEmail({
  code = "123456",
  name,
}: VerificationEmailProps) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <Font fontFamily="Georgia" fallbackFontFamily="serif" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>Your BTC Today verification code: {code}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            <Img src="https://btctoday.co/logo.png" width="120" height="144" alt="BTC Today" style={{ margin: "0 auto", width: "80px", height: "auto" }} />
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.content}>
            <Heading as="h1" style={styles.heading}>
              Verify your email
            </Heading>

            <Text style={styles.bodyText}>
              {greeting} Enter this code to complete your signup:
            </Text>

            <Section style={styles.codeBox}>
              <Text style={styles.codeText}>{code}</Text>
            </Section>

            <Text style={styles.bodyText}>
              This code expires in 10 minutes. If you didn&apos;t request this,
              you can safely ignore this email.
            </Text>
          </Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              BTC Today / Daily Bitcoin intelligence for investors.
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

  codeBox: {
    backgroundColor: colors.bgSurface,
    border: `2px solid ${colors.accent}`,
    borderRadius: "12px",
    padding: "20px",
    margin: "0 0 24px",
    textAlign: "center" as const,
  } as React.CSSProperties,

  codeText: {
    fontFamily: "'Courier New', Courier, monospace",
    fontSize: "36px",
    fontWeight: "700",
    letterSpacing: "0.3em",
    color: colors.textPrimary,
    margin: "0",
  } as React.CSSProperties,

  footer: {
    textAlign: "center" as const,
    padding: "24px 0 32px",
  } as React.CSSProperties,

  footerText: {
    fontSize: "12px",
    color: colors.textMuted,
    margin: "0",
    lineHeight: "1.6",
  } as React.CSSProperties,
} as const;
