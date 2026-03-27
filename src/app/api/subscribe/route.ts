import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: { email?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { success: false, error: "Invalid email" },
      { status: 400 }
    );
  }

  // Upsert subscriber (handles new + re-subscribe)
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("subscribers")
    .upsert({ email, status: "active" }, { onConflict: "email" });

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
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

      await resend.emails.send({
        from: "BTC Today <digest@btctoday.dev>",
        to: email,
        subject: "Welcome to BTC Today",
        text: `Welcome to BTC Today!\n\nYou'll receive a daily Bitcoin intelligence briefing every morning at 2 AM CET.\n\nRead today's briefing: ${siteUrl}\n\n— BTC Today`,
      });
    } catch {
      // Non-fatal — subscriber is already saved
    }
  }

  return NextResponse.json(
    { success: true, message: "Subscribed!" },
    { status: 201 }
  );
}
