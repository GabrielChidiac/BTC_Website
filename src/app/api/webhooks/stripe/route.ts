import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { verifyStripeWebhook } from "@/lib/stripe";
import ProWelcomeEmail from "../../../../../emails/pro-welcome";
import TipReceiptEmail from "../../../../../emails/tip-receipt";

type ServiceClient = ReturnType<typeof createServiceClient>;

const MAGIC_LINK_EXPIRY_DAYS = 7;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

/**
 * Reconcile a one-time tip payment to the stripe_tips table. Idempotent --
 * if the row is already paid, no-op. Stripe webhooks are at-least-once,
 * so this branch may be invoked more than once per session.
 *
 * After marking paid, sends a branded BTC Today thank-you receipt via
 * Resend. This runs alongside the Stripe automatic email receipt
 * (forced via payment_intent_data.receipt_email at checkout creation).
 * Both send so a missed dashboard config or spam-filter quirk on either
 * side cannot leave the tipper without confirmation.
 */
async function handleTipPayment(
  session: Stripe.Checkout.Session,
  supabase: ServiceClient
) {
  const tipId = session.metadata?.tip_id ?? null;
  const sessionId = session.id;

  // Look up the full tip row (including upfront-collected email + name +
  // briefing_date) so the branded receipt has all the context it needs.
  type TipRow = {
    id: string;
    paid: boolean;
    amount_cents: number;
    tipper_email: string | null;
    tipper_name: string | null;
    briefing_date: string | null;
  };
  const tipColumns =
    "id, paid, amount_cents, tipper_email, tipper_name, briefing_date";

  let row: TipRow | null = null;
  if (tipId) {
    const { data } = await supabase
      .from("stripe_tips")
      .select(tipColumns)
      .eq("id", tipId)
      .maybeSingle<TipRow>();
    row = data;
  }
  if (!row) {
    const { data } = await supabase
      .from("stripe_tips")
      .select(tipColumns)
      .eq("stripe_session_id", sessionId)
      .maybeSingle<TipRow>();
    row = data;
  }

  if (!row) {
    return NextResponse.json({ ok: true, action: "ignored_unknown_tip" });
  }

  if (row.paid) {
    return NextResponse.json({ ok: true, action: "ignored_already_paid" });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  // Prefer the upfront-collected email (always present). Fall back to
  // the email Stripe captured on its hosted page in case of legacy rows.
  const stripeEmail = session.customer_details?.email ?? null;
  const receiptEmail = (row.tipper_email ?? stripeEmail)?.toLowerCase().trim() ?? null;
  const paidAt = new Date().toISOString();

  await supabase
    .from("stripe_tips")
    .update({
      paid: true,
      paid_at: paidAt,
      stripe_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId,
      tipper_email: receiptEmail,
    })
    .eq("id", row.id);

  // ── Branded BTC Today receipt (non-fatal) ─────────────────────────
  if (receiptEmail) {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const siteUrl = getBaseUrl();
        const amountUsd = formatUsdCents(row.amount_cents);
        const resend = new Resend(resendKey);
        const html = await render(
          TipReceiptEmail({
            email: receiptEmail,
            amountUsd,
            tipperName: row.tipper_name,
            briefingDate: row.briefing_date,
            paidAt,
            siteUrl,
          })
        );

        const text = [
          row.tipper_name ? `Thank you, ${row.tipper_name}.` : "Thank you.",
          "",
          `We received your tip of ${amountUsd}. This email is your BTC Today record of the payment. Stripe will also send a standard card receipt for your records.`,
          row.briefing_date
            ? `\nTip referenced the briefing from ${row.briefing_date}.`
            : "",
          "",
          `Amount:    ${amountUsd}`,
          `Paid:      ${new Date(paidAt).toUTCString()}`,
          `Statement: BTC TODAY TIP`,
          `Email:     ${receiptEmail}`,
          "",
          `Read today's brief: ${siteUrl}`,
          "",
          "Questions? Reply to this email or write hello@btctoday.co.",
        ]
          .filter(Boolean)
          .join("\n");

        await resend.emails.send({
          from: "BTC Today <hello@btctoday.co>",
          to: receiptEmail,
          subject: `Tip received: ${amountUsd}`,
          html,
          text,
        });
      } catch {
        // Non-fatal: payment is already recorded, Stripe also sent its
        // own receipt via payment_intent.receipt_email.
      }
    }
  }

  return NextResponse.json({ ok: true, action: "tip_paid", tip_id: row.id });
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  const event = verifyStripeWebhook(body, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // ── Checkout completed (route on session.mode) ────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // One-time card tips run in mode='payment' and reconcile to stripe_tips.
    if (session.mode === "payment") {
      return handleTipPayment(session, supabase);
    }

    if (session.mode !== "subscription") {
      return NextResponse.json({ ok: true, action: "ignored_unknown_mode" });
    }

    const email = session.customer_details?.email?.toLowerCase().trim();
    if (!email) {
      return NextResponse.json({ error: "No email in session" }, { status: 400 });
    }

    const stripeCustomerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;
    const stripeSubscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id ?? null;

    // Check if subscriber exists and what their current state is
    const { data: existing } = await supabase
      .from("subscribers")
      .select("id, tier, stripe_subscription_id, name")
      .eq("email", email)
      .maybeSingle();

    // Determine if this is actually a new upgrade (for idempotent email sending)
    const isNewUpgrade = !existing
      || existing.tier !== "pro"
      || existing.stripe_subscription_id !== stripeSubscriptionId;

    if (existing) {
      // Upgrade existing subscriber to pro and reactivate if needed
      await supabase
        .from("subscribers")
        .update({
          status: "active",
          tier: "pro",
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          tier_updated_at: new Date().toISOString(),
        })
        .eq("email", email);
    } else {
      // Create new pro subscriber (they paid but weren't subscribed yet)
      await supabase.from("subscribers").insert({
        email,
        status: "active",
        tier: "pro",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        tier_updated_at: new Date().toISOString(),
      });
    }

    // Send Pro welcome email with magic link (only on actual upgrades)
    if (isNewUpgrade) {
      const resendKey = process.env.RESEND_API_KEY;
      if (resendKey) {
        try {
          const siteUrl = getBaseUrl();
          const token = generateToken();
          const expiresAt = new Date(
            Date.now() + MAGIC_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          );

          await supabase.from("verification_codes").insert({
            email,
            code: `magic:${token}`,
            expires_at: expiresAt.toISOString(),
          });

          const magicLink = `${siteUrl}/sign-in?token=${token}&email=${encodeURIComponent(email)}`;
          const subscriberName = existing?.name ?? undefined;

          const resend = new Resend(resendKey);
          const html = await render(
            ProWelcomeEmail({ email, name: subscriberName, siteUrl, magicLink })
          );

          await resend.emails.send({
            from: "BTC Today <hello@btctoday.co>",
            to: email,
            subject: "Welcome to BTC Today Pro",
            html,
            text: `You're Pro.\n\nThanks for upgrading. You now have the full BTC Today experience.\n\nWhat you get:\n- Daily briefing delivered to your inbox at 2 AM CET\n- ETF flows, institutional activity, and whale movements\n- Technical signals, network health, and on-chain data\n- Expert insights and forward outlook\n- PDF downloads and full archive access\n\nLog in here: ${magicLink}\n\n- BTC Today`,
          });
        } catch {
          // Non-fatal - upgrade already applied
        }
      }
    }

    return NextResponse.json({ ok: true, action: "upgraded_to_pro" });
  }

  // ── Subscription reactivated ──────────────────────────────────────
  if (event.type === "customer.subscription.updated") {
    const subscription = event.data.object;

    // Only act when status changes TO active
    if (subscription.status !== "active") {
      return NextResponse.json({ ok: true, action: "ignored_non_active" });
    }

    const previousStatus = event.data.previous_attributes &&
      "status" in event.data.previous_attributes
      ? event.data.previous_attributes.status
      : null;

    // Skip if already active (no actual change)
    if (previousStatus === "active" || previousStatus === null) {
      return NextResponse.json({ ok: true, action: "ignored_already_active" });
    }

    const stripeCustomerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

    if (!stripeCustomerId) {
      return NextResponse.json({ ok: true, action: "ignored_no_customer" });
    }

    // Look up subscriber by stripe_customer_id
    const { data: sub } = await supabase
      .from("subscribers")
      .select("email, tier")
      .eq("stripe_customer_id", stripeCustomerId)
      .maybeSingle();

    if (sub && sub.tier !== "pro") {
      await supabase
        .from("subscribers")
        .update({
          tier: "pro",
          stripe_subscription_id: subscription.id,
          tier_updated_at: new Date().toISOString(),
        })
        .eq("stripe_customer_id", stripeCustomerId);
    }

    return NextResponse.json({ ok: true, action: "reactivated" });
  }

  // ── Subscription cancelled / expired ──────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;

    // Look up subscriber by subscription ID
    const { data: sub } = await supabase
      .from("subscribers")
      .select("stripe_subscription_id, tier, is_founding_member")
      .eq("stripe_subscription_id", subscription.id)
      .maybeSingle();

    // Never downgrade founding members -- their Pro access is permanent
    if (sub && sub.is_founding_member) {
      // Clear Stripe IDs but preserve Pro tier
      await supabase
        .from("subscribers")
        .update({
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .eq("stripe_subscription_id", subscription.id);

      return NextResponse.json({ ok: true, action: "founding_member_protected" });
    }

    if (sub && sub.tier === "pro") {
      await supabase
        .from("subscribers")
        .update({
          tier: "free",
          tier_updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
    }

    return NextResponse.json({ ok: true, action: "downgraded_to_free" });
  }

  // Unhandled event - acknowledge it
  return NextResponse.json({ ok: true, action: "ignored" });
}
