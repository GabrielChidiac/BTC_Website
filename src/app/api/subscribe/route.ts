import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson, subscribeSchema } from "@/lib/validation";
import VerificationEmail from "../../../../emails/verification";

const CODE_EXPIRY_MINUTES = 10;
const RATE_LIMIT_SECONDS = 60;

function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(num % 1000000).padStart(6, "0");
}

export async function POST(request: Request) {
  // ── Rate limit: 5 signups per minute per IP ──────────────────────
  // Protects against botnet signup spam that would drain Resend credits
  // and pollute the subscribers table. Per-email limit (DB-based) still
  // runs below as a second defence layer.
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`subscribe:ip:${ip}`, {
    limit: 5,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  // ── Input validation via zod ─────────────────────────────────────
  const parsed = await parseJson(subscribeSchema, request);
  if (!parsed.ok) return parsed.response;

  // Honeypot: silently accept bots without processing
  if (parsed.data.website) {
    return NextResponse.json(
      { success: true, step: "verify", message: "Check your email for a verification code" },
      { status: 200 }
    );
  }

  const email = parsed.data.email;
  const rawName = parsed.data.name;
  const name = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();

  // Belt-and-suspenders: stricter email regex than zod's .email() built-in.
  // The manual regex in constants.ts rejects some edge cases zod accepts.
  if (!EMAIL_RE.test(email)) {
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
    return NextResponse.json(
      { success: false, error: "already_subscribed" },
      { status: 409 }
    );
  }

  // Rate limit: 1 verification code per email per 60 seconds
  const cutoff = new Date(Date.now() - RATE_LIMIT_SECONDS * 1000).toISOString();
  const { data: recentCode } = await supabase
    .from("verification_codes")
    .select("id")
    .eq("email", email)
    .like("code", "signup:%")
    .eq("used", false)
    .gte("created_at", cutoff)
    .maybeSingle();

  if (recentCode) {
    return NextResponse.json(
      { success: false, error: "Verification code already sent. Check your email or wait 60 seconds." },
      { status: 429 }
    );
  }

  // Upsert subscriber as "pending" (or keep "unsubscribed" → "pending")
  const { error: upsertError } = await supabase
    .from("subscribers")
    .upsert(
      { email, status: "pending", name },
      { onConflict: "email" }
    );

  if (upsertError) {
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }

  // Mark old unused signup codes for this email as used
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("email", email)
    .like("code", "signup:%")
    .eq("used", false);

  // Generate and store verification code
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

  const { error: codeError } = await supabase
    .from("verification_codes")
    .insert({
      email,
      code: `signup:${code}`,
      expires_at: expiresAt.toISOString(),
    });

  if (codeError) {
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }

  // Send verification email (non-fatal)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const html = await render(VerificationEmail({ code, name }));

      await resend.emails.send({
        from: "BTC Today <hello@btctoday.co>",
        to: email,
        subject: `${code} is your BTC Today verification code`,
        html,
        text: `Your BTC Today verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n- BTC Today`,
      });
    } catch {
      // Non-fatal — code is stored, user can resend
    }
  }

  return NextResponse.json(
    { success: true, step: "verify", message: "Check your email for a verification code" },
    { status: 200 }
  );
}
