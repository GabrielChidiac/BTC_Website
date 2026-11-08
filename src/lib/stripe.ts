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

/**
 * Create a Stripe Customer Portal session where the subscriber can cancel,
 * switch plans, update their card, and download invoices. Requires the
 * portal to be configured in the Stripe Dashboard (Settings -> Billing ->
 * Customer portal) for the live/test mode in use, otherwise Stripe errors.
 */
export async function createBillingPortalSession(
  customerId: string
): Promise<{ data: { url: string }; error: null } | { data: null; error: string }> {
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: getBaseUrl(),
    });
    return { data: { url: session.url }, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Stripe error",
    };
  }
}

/** Subscription statuses that can still produce a future charge. */
const BILLABLE_STATUSES = new Set<Stripe.Subscription.Status>([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

/**
 * Stop all future billing for a customer: every subscription that could
 * still charge them is set to cancel at period end (they keep what they
 * already paid for, matching the pricing-page promise). Checks Stripe
 * directly rather than trusting the DB's single subscription id, so
 * duplicate subscriptions are caught too. Idempotent.
 *
 * Returns the number of subscriptions newly scheduled for cancellation.
 */
export async function cancelAllSubscriptions(
  customerId: string
): Promise<{ data: { cancelled: number }; error: null } | { data: null; error: string }> {
  try {
    const stripe = getStripe();
    let cancelled = 0;
    for await (const sub of stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 100,
    })) {
      if (!BILLABLE_STATUSES.has(sub.status)) continue;
      if (sub.status === "incomplete") {
        // No successful first payment yet; cancel outright so it cannot complete later.
        await stripe.subscriptions.cancel(sub.id);
        cancelled++;
        continue;
      }
      if (sub.cancel_at_period_end) continue;
      await stripe.subscriptions.update(sub.id, { cancel_at_period_end: true });
      cancelled++;
    }
    return { data: { cancelled }, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Stripe error",
    };
  }
}

export interface CreateTipCheckoutInput {
  tipId: string;
  amountCents: number;
  tipperEmail?: string | null;
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
      // Pre-fill email only if we collected it client-side. When omitted,
      // Stripe Checkout collects it natively and the webhook reads it from
      // session.customer_details.email.
      ...(input.tipperEmail ? { customer_email: input.tipperEmail } : {}),
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
        // Pin the receipt email up front when we have it. Without it,
        // Stripe still sends its automatic receipt to the email collected
        // at checkout (dashboard default). The webhook also sends a
        // branded BTC Today thank-you via Resend regardless.
        ...(input.tipperEmail ? { receipt_email: input.tipperEmail } : {}),
        statement_descriptor_suffix: "BTC TODAY TIP",
        metadata: {
          tip_id: input.tipId,
          source: input.source,
          briefing_date: input.briefingDate ?? "",
          tipper_name: input.tipperName ?? "",
          tipper_email: input.tipperEmail ?? "",
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
