import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
import WelcomeEmail from "../../../../../emails/welcome";

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

  // Fetch subscriber name for welcome email
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("name")
    .eq("email", email)
    .maybeSingle();

  // Send welcome email (non-fatal)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const siteUrl = getBaseUrl();
      const name = subscriber?.name ?? undefined;

      const html = await render(WelcomeEmail({ email, name, siteUrl }));

      await resend.emails.send({
        from: "BTC Today <hello@btctoday.co>",
        to: email,
        subject: "Welcome to BTC Today",
        html,
        text: `Welcome to BTC Today!\n\nA new briefing publishes every morning at 2 AM CET. Visit btctoday.co to read the latest. You'll also receive a weekly recap every Sunday.\n\nRead today's briefing: ${siteUrl}\n\nUpgrade to Pro for the daily email, AI chat, PDF downloads, and more: ${siteUrl}/pricing\n\nUnsubscribe: ${siteUrl}/sign-in\n\n— BTC Today`,
      });
    } catch {
      // Non-fatal — subscriber is already activated
    }
  }

  return NextResponse.json(
    { success: true, message: "You're in!" },
    { status: 200 }
  );
}
