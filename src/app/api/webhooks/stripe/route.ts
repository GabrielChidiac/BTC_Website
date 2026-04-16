import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { verifyStripeWebhook } from "@/lib/stripe";
import ProWelcomeEmail from "../../../../../emails/pro-welcome";

const MAGIC_LINK_EXPIRY_DAYS = 7;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  const event = verifyStripeWebhook(body, signature);
  if (!event) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // ── New subscription (checkout completed) ─────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Only handle subscription checkouts
    if (session.mode !== "subscription") {
      return NextResponse.json({ ok: true, action: "ignored_non_subscription" });
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
