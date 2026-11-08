import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { createServiceClient } from "@/lib/supabase/server";
import { getBaseUrl } from "@/lib/url";
import { clearSessionCookie } from "@/lib/session";
import { getSubscriberTier } from "@/lib/tier";
import { cancelAllSubscriptions } from "@/lib/stripe";
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

  // Verified session only (token checked against the DB). This route now
  // cancels billing, so a forged cookie must never be enough.
  const { email } = await getSubscriberTier();
  if (!email) {
    return NextResponse.json(
      { success: false, error: "Your session has expired. Log in again to unsubscribe." },
      { status: 401 }
    );
  }

  const supabase = createServiceClient();

  const { data: subscriber, error: lookupError } = await supabase
    .from("subscribers")
    .select("name, stripe_customer_id")
    .eq("email", email)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { success: false, error: "Something went wrong. Try again, or email hello@btctoday.co." },
      { status: 500 }
    );
  }

  const name = subscriber?.name ?? undefined;

  // Stop billing BEFORE unsubscribing. Unsubscribed accounts cannot log in,
  // so if we unsubscribed first and the Stripe call failed, the user would
  // be locked out while still being charged. Fail closed instead.
  let billingCancelled = false;
  if (subscriber?.stripe_customer_id) {
    const cancel = await cancelAllSubscriptions(subscriber.stripe_customer_id);
    if (cancel.error !== null) {
      console.error("Unsubscribe: Stripe cancellation failed:", cancel.error);
      return NextResponse.json(
        {
          success: false,
          error: "We could not cancel your Pro billing, so nothing was changed. Try again in a minute, or email hello@btctoday.co and we will cancel it for you.",
        },
        { status: 502 }
      );
    }
    billingCancelled = true;
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
        UnsubscribeConfirmationEmail({ email, name, siteUrl, billingCancelled })
      );

      await resend.emails.send({
        from: "BTC Today <hello@btctoday.co>",
        to: email,
        subject: "You've been unsubscribed from BTC Today",
        html,
        text: `Hi${name ? ` ${name}` : ""},\n\nThis confirms that ${email} has been removed from all BTC Today emails. You will no longer receive daily briefings or weekly recaps.${billingCancelled ? "\n\nYour Pro subscription has been cancelled and you will not be charged again." : ""}\n\nChanged your mind? You can re-subscribe at any time at ${siteUrl}.\n\nIf you have any feedback, reach out at hello@btctoday.co.\n\n- BTC Today`,
      });
    } catch {
      // Non-fatal — unsubscribe is already processed
    }
  }

  // Clear the session cookie
  const response = NextResponse.json({
    success: true,
    billingCancelled,
    message: billingCancelled
      ? "You have been unsubscribed and your Pro billing is cancelled."
      : "You have been unsubscribed.",
  });
  clearSessionCookie(response);
  return response;
}
