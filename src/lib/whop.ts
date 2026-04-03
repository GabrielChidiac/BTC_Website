import { createHmac, timingSafeEqual } from "crypto";

/**
 * Verify a Whop webhook signature.
 * Whop signs webhooks with HMAC-SHA256 using the webhook key.
 */
export function verifyWhopWebhook(
  body: string,
  signature: string
): boolean {
  const secret = process.env.WHOP_WEBHOOK_KEY;
  if (!secret) return false;

  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}
