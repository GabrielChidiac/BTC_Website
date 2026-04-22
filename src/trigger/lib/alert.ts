import { logger } from "@trigger.dev/sdk/v3";

/**
 * Send an ops alert email to the owner. Used for pipeline failures (outer
 * catch) and for degraded-but-shipped days (health gate). Never throws —
 * alert send failures are logged and swallowed so they can't cascade into
 * the pipeline's own failure path.
 *
 * Two-tiered severity:
 *  - "critical" (default): pipeline actually failed, re-thrown after send
 *  - "degraded": pipeline shipped but health gate fired, no re-throw
 */
export async function sendOwnerAlert(params: {
  subject: string;
  text: string;
  severity?: "critical" | "degraded";
}): Promise<void> {
  const { subject, text, severity = "critical" } = params;
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      logger.warn("sendOwnerAlert: RESEND_API_KEY not set, skipping alert", { subject });
      return;
    }
    const { Resend } = await import("resend");
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "BTC Today Alerts <hello@btctoday.co>",
      to: "hello@btctoday.co",
      subject: `[${severity.toUpperCase()}] ${subject}`,
      text,
    });
  } catch (e) {
    logger.warn("sendOwnerAlert: alert email failed", {
      subject,
      error: (e as Error).message,
    });
  }
}
