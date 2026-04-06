import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
import VerificationEmail from "../../../../emails/verification";

const NAME_MAX = 50;
const EMAIL_MAX = 254;
const CODE_EXPIRY_MINUTES = 10;
const RATE_LIMIT_SECONDS = 60;

function generateCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return String(num % 1000000).padStart(6, "0");
}

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
      { success: true, step: "verify", message: "Check your email for a verification code" },
      { status: 200 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const rawName = body.name?.trim() || null;
  const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : null;

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
      { email, status: "pending", ...(name ? { name } : {}) },
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
      const html = await render(VerificationEmail({ code, name: name ?? undefined }));

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
