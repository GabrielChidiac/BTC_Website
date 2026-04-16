import Stripe from "stripe";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return _stripe;
}

/**
 * Verify a Stripe webhook signature and parse the event.
 * Returns the parsed event on success, or null on failure.
 */
export function verifyStripeWebhook(
  body: string,
  signature: string
): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return null;

  try {
    return getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return null;
  }
}
