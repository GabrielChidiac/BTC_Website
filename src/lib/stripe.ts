import Stripe from "stripe";
import { getBaseUrl } from "@/lib/url";

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

export interface CreateTipCheckoutInput {
  tipId: string;
  amountCents: number;
  tipperName?: string | null;
  message?: string | null;
  briefingDate?: string | null;
  source: "site" | "newsletter" | "archive" | "footer";
}

export type CreateTipCheckoutResult =
  | { data: { url: string; sessionId: string }; error: null }
  | { data: null; error: string };

/**
 * Create a one-time Stripe Checkout Session for a card tip. Returns the
 * hosted Checkout URL the browser should be redirected to. tipId must be
 * the UUID of an existing stripe_tips row in paid=false state -- the
 * webhook reconciles by metadata.tip_id when the payment completes.
 *
 * The default Stripe button reads "Pay" (we omit submit_type: "donate"
 * intentionally for Swiss tax neutrality). statement_descriptor_suffix
 * keeps "BTC TODAY TIP" on the cardholder's bank statement to reduce
 * friendly-fraud chargebacks.
 */
export async function createTipCheckoutSession(
  input: CreateTipCheckoutInput
): Promise<CreateTipCheckoutResult> {
  try {
    const stripe = getStripe();
    const baseUrl = getBaseUrl();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "BTC Today tip",
              description: input.briefingDate
                ? `Tip for the ${input.briefingDate} briefing`
                : "Tip to support BTC Today",
            },
            unit_amount: input.amountCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        statement_descriptor_suffix: "BTC TODAY TIP",
        metadata: {
          tip_id: input.tipId,
          source: input.source,
          briefing_date: input.briefingDate ?? "",
          tipper_name: input.tipperName ?? "",
        },
      },
      metadata: { tip_id: input.tipId },
      success_url: `${baseUrl}/tip/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/tip?method=card`,
      allow_promotion_codes: false,
    });
    if (!session.url) {
      return { data: null, error: "No checkout URL returned" };
    }
    return { data: { url: session.url, sessionId: session.id }, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Stripe error",
    };
  }
}
