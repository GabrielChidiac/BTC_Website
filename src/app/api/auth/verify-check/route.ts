import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { setSessionCookie } from "@/lib/session";
import { getFoundingMemberStatus } from "@/lib/founding";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson, verifyCheckSchema } from "@/lib/validation";

export async function POST(request: Request) {
  // ── Rate limit: 30 token checks per minute per IP ────────────────
  // Magic tokens are 32 random bytes (2^256 search space) so brute
  // force is not feasible, but rate limiting still prevents a bot from
  // burning the DB with token lookups at full speed.
  const ip = getClientIp(request);
  const ipLimit = await checkRateLimit(`verify-check:ip:${ip}`, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  // ── Input validation via zod ─────────────────────────────────────
  const parsed = await parseJson(verifyCheckSchema, request);
  if (!parsed.ok) return parsed.response;

  const { email, token } = parsed.data;

  // Per-email bucket for extra defence against brute force on a
  // specific account (low risk given the 2^256 token space, but cheap).
  const emailLimit = await checkRateLimit(`verify-check:email:${email}`, {
    limit: 10,
    windowSeconds: 15 * 60,
  });
  if (!emailLimit.ok) {
    return rateLimitResponse(emailLimit.retryAfter);
  }

  const supabase = createServiceClient();

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

  // Magic tokens are NOT consumed — they remain valid until expiry so
  // all links in a single digest email (briefing, PDF) keep working.
  // The 30-day session cookie handles ongoing authentication.

  const { data: subscriber, error: subscriberError } = await supabase
    .from("subscribers")
    .select("name, status, tier, is_founding_member")
    .eq("email", email)
    .maybeSingle();

  if (subscriberError) {
    console.error("Subscriber lookup failed:", subscriberError.message);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  if (!subscriber) {
    return NextResponse.json(
      { error: "No account found for this email." },
      { status: 403 }
    );
  }

  if (subscriber.status !== "active") {
    await supabase
      .from("subscribers")
      .update({ status: "active" })
      .eq("email", email);
  }

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
    const toEvict = activeSessions.slice(0, activeSessions.length - MAX_SESSIONS + 1);
    await supabase
      .from("verification_codes")
      .update({ used: true })
      .in("id", toEvict.map((s) => s.id));
  }

  const sessionBytes = new Uint8Array(32);
  crypto.getRandomValues(sessionBytes);
  const sessionToken = Array.from(sessionBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
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
