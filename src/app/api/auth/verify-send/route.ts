import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson, verifySendSchema } from "@/lib/validation";

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
  // ── Rate limit: 5 magic-link sends per minute per IP ─────────────
  // The per-email DB limit further down still runs. This IP limit
  // catches bots that rotate emails to burn Resend credits or
  // enumerate the subscriber list via the distinct 404 response
  // below.
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`verify-send:ip:${ip}`, {
    limit: 5,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  // ── Input validation via zod ─────────────────────────────────────
  const parsed = await parseJson(verifySendSchema, request);
  if (!parsed.ok) return parsed.response;

  const email = parsed.data.email;

  // Belt-and-suspenders: stricter email regex than zod's .email() built-in.
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

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

  if (!subscriber) {
    return NextResponse.json(
      {
        error: "No account found for this email. Subscribe on the homepage to create one.",
        code: "no_account",
      },
      { status: 404 }
    );
  }

  if (subscriber.status === "pending") {
    return NextResponse.json(
      {
        error: "Your subscription isn't confirmed yet. Check your inbox for the confirmation email.",
        code: "pending",
      },
      { status: 403 }
    );
  }

  if (subscriber.status !== "active") {
    return NextResponse.json(
      {
        error: "This account is inactive. Subscribe on the homepage to reactivate it.",
        code: "inactive",
      },
      { status: 403 }
    );
  }

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

  const siteUrl = getBaseUrl();
  const magicLink = `${siteUrl}/sign-in?token=${token}&email=${encodeURIComponent(email)}`;

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
      subject: "Login to BTC Today",
      text: `Click the link below to log in to BTC Today:\n\n${magicLink}\n\nThis link expires in ${TOKEN_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n- BTC Today`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #1a1a1a; margin: 0 0 8px;">BTC Today</h2>
          <p style="font-size: 14px; color: #666; margin: 0 0 24px;">Log in to your account</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #F7931A; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px;">Login</a>
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
