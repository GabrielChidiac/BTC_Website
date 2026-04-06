import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { verifyWhopWebhook } from "@/lib/whop";
import ProWelcomeEmail from "../../../../../emails/pro-welcome";

const MAGIC_LINK_EXPIRY_DAYS = 7;

interface WhopWebhookPayload {
  action: string;
  data: {
    id: string;
    user: {
      id: string;
      email: string;
    };
    status: string;
  };
}

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("whop-signature") ?? "";

  if (!verifyWhopWebhook(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: WhopWebhookPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, data } = payload;
  const email = data?.user?.email?.toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ error: "No email in payload" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (action === "membership.went_valid" || action === "membership_activated") {
    // Check if subscriber exists and what their current state is
    const { data: existing } = await supabase
      .from("subscribers")
      .select("id, tier, whop_membership_id, name")
      .eq("email", email)
      .maybeSingle();

    // Determine if this is actually a new upgrade (for idempotent email sending)
    const isNewUpgrade = !existing
      || existing.tier !== "pro"
      || existing.whop_membership_id !== data.id;

    if (existing) {
      // Upgrade existing subscriber to pro and reactivate if needed
      await supabase
        .from("subscribers")
        .update({
          status: "active",
          tier: "pro",
          whop_user_id: data.user.id,
          whop_membership_id: data.id,
          tier_updated_at: new Date().toISOString(),
        })
        .eq("email", email);
    } else {
      // Create new pro subscriber (they paid but weren't subscribed yet)
      await supabase.from("subscribers").insert({
        email,
        status: "active",
        tier: "pro",
        whop_user_id: data.user.id,
        whop_membership_id: data.id,
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
            text: `You're Pro.\n\nThanks for upgrading. You now have the full BTC Today experience.\n\nWhat you get:\n- Daily briefing delivered to your inbox at 2 AM CET\n- ETF flows, institutional activity, and whale movements\n- Technical signals, network health, and on-chain data\n- Expert insights and forward outlook\n- AI chat for live questions\n- PDF downloads and full archive access\n\nLog in here: ${magicLink}\n\n- BTC Today`,
          });
        } catch {
          // Non-fatal - upgrade already applied
        }
      }
    }

    return NextResponse.json({ ok: true, action: "upgraded_to_pro" });
  }

  if (action === "membership.went_invalid" || action === "membership_deactivated") {
    // Only downgrade if this membership is the one that granted pro
    const { data: sub } = await supabase
      .from("subscribers")
      .select("whop_membership_id, tier, is_founding_member")
      .eq("email", email)
      .maybeSingle();

    // Never downgrade founding members — their Pro access is permanent
    if (sub && sub.is_founding_member) {
      // Clear Whop IDs but preserve Pro tier
      await supabase
        .from("subscribers")
        .update({
          whop_user_id: null,
          whop_membership_id: null,
        })
        .eq("email", email);

      return NextResponse.json({ ok: true, action: "founding_member_protected" });
    }

    if (sub && sub.tier === "pro" && sub.whop_membership_id === data.id) {
      await supabase
        .from("subscribers")
        .update({
          tier: "free",
          tier_updated_at: new Date().toISOString(),
        })
        .eq("email", email);
    }

    return NextResponse.json({ ok: true, action: "downgraded_to_free" });
  }

  // Unhandled event - acknowledge it
  return NextResponse.json({ ok: true, action: "ignored" });
}
