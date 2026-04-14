import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { COOKIE_NAME, clearSessionCookie } from "@/lib/session";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import UnsubscribeConfirmationEmail from "../../../../emails/unsubscribe-confirmation";

export async function POST(request: Request) {
  // ── Rate limit: 10 unsubscribe attempts per minute per IP ────────
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`unsubscribe:ip:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (!raw) {
    return NextResponse.json(
      { success: false, error: "Not logged in" },
      { status: 401 }
    );
  }

  let email: string | undefined;
  let name: string | undefined;
  try {
    const parsed = JSON.parse(raw);
    email = parsed.email?.trim().toLowerCase();
    name = parsed.name;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid session" },
      { status: 400 }
    );
  }

  if (!email) {
    return NextResponse.json(
      { success: false, error: "Invalid session" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Fetch subscriber name if not in cookie
  if (!name) {
    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("name")
      .eq("email", email)
      .maybeSingle();
    name = subscriber?.name ?? undefined;
  }

  const { error } = await supabase
    .from("subscribers")
    .update({ status: "unsubscribed" })
    .eq("email", email);

  if (error) {
    return NextResponse.json(
      { success: false, error: "Something went wrong" },
      { status: 500 }
    );
  }

  // Send unsubscribe confirmation email (non-fatal)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const resend = new Resend(resendKey);
      const siteUrl = getBaseUrl();
      const html = await render(
        UnsubscribeConfirmationEmail({ email, name, siteUrl })
      );

      await resend.emails.send({
        from: "BTC Today <hello@btctoday.co>",
        to: email,
        subject: "You've been unsubscribed from BTC Today",
        html,
        text: `Hi${name ? ` ${name}` : ""},\n\nThis confirms that ${email} has been removed from all BTC Today emails. You will no longer receive daily briefings or weekly recaps.\n\nChanged your mind? You can re-subscribe at any time at ${siteUrl}.\n\nIf you have any feedback, reach out at hello@btctoday.co.\n\n- BTC Today`,
      });
    } catch {
      // Non-fatal — unsubscribe is already processed
    }
  }

  // Clear the session cookie
  const response = NextResponse.json(
    { success: true, message: "You have been unsubscribed." }
  );
  clearSessionCookie(response);
  return response;
}
