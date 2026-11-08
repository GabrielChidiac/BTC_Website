import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getSubscriberTier } from "@/lib/tier";
import { createBillingPortalSession } from "@/lib/stripe";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Opens the Stripe Customer Portal for the signed-in subscriber: cancel,
 * switch monthly/annual, update card, download invoices. Requires a valid
 * session (getSubscriberTier verifies the token, not just the cookie).
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`billing-portal:ip:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  const { email } = await getSubscriberTier();
  if (!email) {
    return NextResponse.json(
      { error: "Your session has expired. Log in again to manage billing." },
      { status: 401 }
    );
  }

  const supabase = createServiceClient();
  const { data: subscriber, error } = await supabase
    .from("subscribers")
    .select("stripe_customer_id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Could not load your billing details. Try again, or email hello@btctoday.co." },
      { status: 500 }
    );
  }

  if (!subscriber?.stripe_customer_id) {
    return NextResponse.json(
      { error: "There is no paid subscription on this account, so there is nothing to bill." },
      { status: 404 }
    );
  }

  const portal = await createBillingPortalSession(subscriber.stripe_customer_id);
  if (portal.error !== null) {
    console.error("Billing portal session failed:", portal.error);
    return NextResponse.json(
      { error: "Billing is unavailable right now. Try again, or email hello@btctoday.co and we will cancel or update it for you." },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: portal.data.url });
}
