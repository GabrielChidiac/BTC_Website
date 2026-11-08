import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/session";
import type { SubscriberTier } from "@/lib/types";

/**
 * Read the btc-session cookie, verify the session token, and return the
 * subscriber's tier.  Falls back to "free" on any error so pages never break.
 */
interface SubscriberInfo {
  tier: SubscriberTier;
  email: string | null;
  name: string | null;
  isFoundingMember: boolean;
  /** True when a Stripe customer is on file, i.e. "Manage billing" has something to show. */
  hasBilling: boolean;
}

export async function getSubscriberTier(): Promise<SubscriberInfo> {
  const FREE: SubscriberInfo = {
    tier: "free",
    email: null,
    name: null,
    isFoundingMember: false,
    hasBilling: false,
  };

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (!raw) return FREE;

    const parsed = JSON.parse(raw) as { email?: string; token?: string };
    const email = parsed.email?.trim().toLowerCase();
    const token = parsed.token;
    if (!email || !token) return FREE;

    const supabase = createServiceClient();

    // Verify session token is still valid
    const { data: session } = await supabase
      .from("verification_codes")
      .select("id")
      .eq("email", email)
      .eq("code", `session:${token}`)
      .eq("used", false)
      .gte("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (!session) return FREE;

    // Get subscriber tier and name
    const { data: subscriber } = await supabase
      .from("subscribers")
      .select("tier, status, name, is_founding_member, stripe_customer_id")
      .eq("email", email)
      .maybeSingle();

    if (!subscriber || subscriber.status !== "active") {
      // Billing access must survive unsubscribing, so an unsubscribed
      // payer can still reach the portal to cancel or fix their card.
      return {
        tier: "free",
        email,
        name: null,
        isFoundingMember: false,
        hasBilling: !!subscriber?.stripe_customer_id,
      };
    }

    return {
      tier: (subscriber.tier as SubscriberTier) ?? "free",
      email,
      name: subscriber.name ?? null,
      isFoundingMember: subscriber.is_founding_member === true,
      hasBilling: !!subscriber.stripe_customer_id,
    };
  } catch {
    return FREE;
  }
}
