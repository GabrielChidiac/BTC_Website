import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { setSessionCookie } from "@/lib/session";
import { EMAIL_REGEX as EMAIL_RE } from "@/lib/constants";
import { getFoundingMemberStatus } from "@/lib/founding";

export async function POST(request: Request) {
  let body: { email?: string; token?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const email = body.email?.trim().toLowerCase();
  const token = body.token?.trim();

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Invalid email" },
      { status: 400 }
    );
  }

  if (!token || token.length < 32) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  // Find valid, unused magic link token
  const { data: magicToken, error: lookupError } = await supabase
    .from("verification_codes")
    .select("id, expires_at")
    .eq("email", email)
    .eq("code", `magic:${token}`)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  if (!magicToken) {
    return NextResponse.json(
      { error: "Invalid or expired link. Please request a new one." },
      { status: 401 }
    );
  }

  // Consume the magic token so it can only be used once.
  // The session cookie (30 days) handles all subsequent access.
  await supabase
    .from("verification_codes")
    .update({ used: true })
    .eq("id", magicToken.id);

  // Verify subscriber is still active before creating a session
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("name, status, tier, is_founding_member")
    .eq("email", email)
    .maybeSingle();

  if (!subscriber || subscriber.status !== "active") {
    return NextResponse.json(
      { error: "Your subscription is no longer active." },
      { status: 403 }
    );
  }

  // Auto-upgrade free subscribers to Pro if founding offer is still active
  if (subscriber.tier === "free" && !subscriber.is_founding_member) {
    const founding = await getFoundingMemberStatus();
    if (founding.isOfferActive) {
      await supabase
        .from("subscribers")
        .update({
          tier: "pro",
          is_founding_member: true,
          tier_updated_at: new Date().toISOString(),
        })
        .eq("email", email);
    }
  }

  // Enforce max 3 concurrent sessions — evict oldest if at limit
  const MAX_SESSIONS = 3;
  const { data: activeSessions } = await supabase
    .from("verification_codes")
    .select("id")
    .eq("email", email)
    .like("code", "session:%")
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  if (activeSessions && activeSessions.length >= MAX_SESSIONS) {
    // Delete oldest sessions to make room for the new one
    const toEvict = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .in("id", toEvict.map((s) => s.id));
  }

  // Generate a long-lived session token
  const sessionBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionBytes);
  const sessionToken = Array.from(sessionBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await supabase
    .from("verification_codes")
    .insert({
      email,
      code: `session:${sessionToken}`,
      expires_at: sessionExpiry.toISOString(),
      used: false,
    });

  const response = NextResponse.json(
    { success: true, token: sessionToken },
    { status: 200 }
  );
  setSessionCookie(response, sessionToken, email, subscriber?.name);
  return response;
}
