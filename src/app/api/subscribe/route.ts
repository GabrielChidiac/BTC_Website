import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
import WelcomeEmail from "../../../../emails/welcome";

const NAME_MAX = 50;
const EMAIL_MAX = 254;

export async function POST(request: Request) {
  let body: { email?: string; name?: string; website?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Honeypot: silently accept bots without processing
  if (body.website) {
    return NextResponse.json(
      { success: true, message: "You're in!" },
      { status: 201 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim() || null;

  if (!name || name.length < 1) {
    return NextResponse.json(
      { success: false, error: "First name is required" },
      { status: 400 }
    );
  }

  if (name.length > NAME_MAX) {
    return NextResponse.json(
      { success: false, error: `Name must be ${NAME_MAX} characters or fewer` },
      { status: 400 }
    );
  }

  if (!email || email.length > EMAIL_MAX || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid email address" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Check if already subscribed
  const { data: existing } = await supabase
    .from("subscribers")
    .select("email, status")
    .eq("email", email)
    .maybeSingle();

  if (existing?.status === "active") {
    // Return same success response to prevent email enumeration
    return NextResponse.json(
      { success: true, message: "You're in!" },
      { status: 201 }
    );
  }

  // Insert new or re-activate
  const { error } = await supabase
    .from("subscribers")
    .upsert(
      { email, status: "active", ...(name ? { name } : {}) },
      { onConflict: "email" }
    );

  if (error) {
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }

  // Welcome email (non-fatal)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const siteUrl = getBaseUrl();

      const html = await render(WelcomeEmail({ email, name: name ?? undefined, siteUrl }));

      await resend.emails.send({
        from: "BTC Today <hello@btctoday.co>",
        to: email,
        subject: "Welcome to BTC Today",
        html,
        text: `Welcome to BTC Today!\n\nA new briefing publishes every morning at 2 AM CET. Visit btctoday.co to read the latest. You'll also receive a weekly recap every Sunday.\n\nRead today's briefing: ${siteUrl}\n\nUpgrade to Pro for the daily email, AI chat, PDF downloads, and more: ${siteUrl}/pricing\n\nUnsubscribe: ${siteUrl}/sign-in\n\n— BTC Today`,
      });
    } catch {
      // Non-fatal — subscriber is already saved
    }
  }

  return NextResponse.json(
    { success: true, message: "You're in!" },
    { status: 201 }
  );
}
