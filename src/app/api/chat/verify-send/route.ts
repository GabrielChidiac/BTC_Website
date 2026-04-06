import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
const TOKEN_EXPIRY_MINUTES = 10;
const RATE_LIMIT_MINUTES = 1;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function POST(request: Request) {
  let body: { email?: string; redirect?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  // Allow callers to specify where the magic link should land (default: /chat)
  const redirectPath = body.redirect === "/sign-in" ? "/sign-in" : "/chat";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Check if email is an active subscriber
  const { data: subscriber, error: subError } = await supabase
    .from("subscribers")
    .select("status")
    .eq("email", email)
    .maybeSingle();

  if (subError) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  if (!subscriber || subscriber.status !== "active") {
    // Return same success response to prevent email enumeration
    return NextResponse.json(
      { success: true, message: "Magic link sent" },
      { status: 200 }
    );
  }

  // Rate limit: check for recent magic links sent to this email
  const { data: recentCode } = await supabase
    .from("verification_codes")
    .select("created_at")
    .eq("email", email)
    .eq("used", false)
    .not("code", "like", "session:%")
    .gte("created_at", new Date(Date.now() - RATE_LIMIT_MINUTES * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentCode) {
    return NextResponse.json(
      { error: "A verification email was recently sent. Please check your inbox or wait a moment." },
      { status: 429 }
    );
  }

  // Generate magic link token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  const { error: insertError } = await supabase
    .from("verification_codes")
    .insert({ email, code: `magic:${token}`, expires_at: expiresAt.toISOString() });

  if (insertError) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  // Build magic link URL
  const siteUrl = getBaseUrl();
  const magicLink = `${siteUrl}${redirectPath}?token=${token}&email=${encodeURIComponent(email)}`;

  // Send magic link email
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 }
    );
  }

  try {
    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: "BTC Today <hello@btctoday.co>",
      to: email,
      subject: redirectPath === "/sign-in" ? "Login to BTC Today" : "Your BTC Today chat access link",
      text: `Click the link below to ${redirectPath === "/sign-in" ? "log in to" : "access the AI assistant on"} BTC Today:\n\n${magicLink}\n\nThis link expires in ${TOKEN_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n— BTC Today`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px;">BTC Today</h2>
          <p style="font-size: 14px; color: #666; margin: 0 0 24px;">${redirectPath === "/sign-in" ? "Log in to your account" : "Access your AI Assistant"}</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #F7931A; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">${redirectPath === "/sign-in" ? "Login" : "Open Chat"}</a>
          <p style="font-size: 13px; color: #999; margin: 24px 0 0;">This link expires in ${TOKEN_EXPIRY_MINUTES} minutes. If you didn't request this, ignore this email.</p>
        </div>
      `,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, message: "Magic link sent" },
    { status: 200 }
  );
}
