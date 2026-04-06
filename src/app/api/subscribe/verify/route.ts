import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
import { setSessionCookie } from "@/lib/session";
import { getFoundingMemberStatus } from "@/lib/founding";
import WelcomeEmail from "../../../../../emails/welcome";
import FoundingWelcomeEmail from "../../../../../emails/founding-welcome";

const SESSION_DAYS = 30;

export async function POST(request: Request) {
  let body: { email?: string; code?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const code = body.code?.trim();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "Invalid email" },
      { status: 400 }
    );
  }

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json(
      { success: false, error: "Invalid verification code" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Look up the verification code
  const { data: record } = await supabase
    .from("verification_codes")
    .select("id, expires_at")
    .eq("email", email)
    .eq("code", `signup:${code}`)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();

  if (!record) {
    return NextResponse.json(
      { success: false, error: "Invalid or expired code. Please request a new one." },
      { status: 401 }
    );
  }

  // Mark code as used
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("id", record.id);

  // Check founding member offer BEFORE activation (so this subscriber
  // isn't counted yet — prevents off-by-one where the 100th subscriber
  // wouldn't get Pro because count already includes them)
  const founding = await getFoundingMemberStatus();
  let isFoundingMember = false;

  // Activate the subscriber
  const { error: updateError } = await supabase
    .from("subscribers")
    .update({ status: "active" })
    .eq("email", email);

  if (updateError) {
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }

  // Auto-upgrade to Pro if founding offer was active
  if (founding.isOfferActive) {
    await supabase
      .from("subscribers")
      .update({
        tier: "pro",
        is_founding_member: true,
        tier_updated_at: new Date().toISOString(),
      })
      .eq("email", email);
    isFoundingMember = true;
  }

  // Fetch subscriber name for welcome email and session
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("name")
    .eq("email", email)
    .maybeSingle();

  const subscriberName = subscriber?.name ?? undefined;

  // Create session so the user is logged in immediately
  const sessionBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionBytes);
  const sessionToken = Array.from(sessionBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sessionExpiry = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await supabase.from("verification_codes").insert({
    email,
    code: `session:${sessionToken}`,
    expires_at: sessionExpiry.toISOString(),
    used: false,
  });

  // Send welcome email (non-fatal)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const siteUrl = getBaseUrl();

      if (isFoundingMember) {
        const html = await render(FoundingWelcomeEmail({ email, name: subscriberName, siteUrl }));

        await resend.emails.send({
          from: "BTC Today <hello@btctoday.co>",
          to: email,
          subject: "You're a Founding Member — BTC Today",
          html,
          text: `You're a Founding Member.\n\nYou joined BTC Today early, and that means something. As one of our first 100 subscribers, you have full Pro access — on the house, permanently.\n\nEvery morning at 2 AM CET, you'll receive a comprehensive briefing in your inbox.\n\nWhat you get:\n- Daily briefing delivered to your inbox\n- Adoption signals and regulatory developments\n- ETF flows, institutional activity, and whale movements\n- Technical signals, network health, and on-chain data\n- Expert insights and forward outlook\n- AI chat for live questions\n- PDF downloads and full archive access\n\nThis is yours to keep.\n\nRead today's briefing: ${siteUrl}\n\n- BTC Today`,
        });
      } else {
        const html = await render(WelcomeEmail({ email, name: subscriberName, siteUrl }));

        await resend.emails.send({
          from: "BTC Today <hello@btctoday.co>",
          to: email,
          subject: "Welcome to BTC Today",
          html,
          text: `Welcome to BTC Today!\n\nA new briefing publishes every morning at 2 AM CET. Visit btctoday.co to read the latest. You'll also receive a weekly recap every Sunday.\n\nRead today's briefing: ${siteUrl}\n\nUpgrade to Pro for the daily email, AI chat, PDF downloads, and more: ${siteUrl}/pricing\n\n- BTC Today`,
        });
      }
    } catch {
      // Non-fatal - subscriber is already activated
    }
  }

  const response = NextResponse.json(
    { success: true, message: "You're in!", loggedIn: true },
    { status: 200 }
  );
  setSessionCookie(response, sessionToken, email, subscriberName);
  return response;
}
