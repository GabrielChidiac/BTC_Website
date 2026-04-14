import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/session";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

// 1 hour signed URL expiry. Audio playback spans several minutes and the
// listener may pause, seek, or restart, so a short expiry would interrupt
// mid-play. 1 hour is still short enough to revoke access if a token leaks.
const SIGNED_URL_EXPIRY = 3600;

/**
 * Token-gated audio route for the BTC Today Pro daily audio brief.
 *
 * Accepts the same two auth paths as /pdf/[date]:
 *   1. Session cookie (btc-session) for logged-in Pro users
 *   2. Magic-link token via ?token=...&email=... query params (for email
 *      listen buttons, same mechanism as the existing PDF route)
 *
 * Responds with a redirect to a short-lived Supabase Storage signed URL
 * pointing at {date}.mp3 in the `briefing-audio` bucket. If the caller is
 * not a Pro subscriber, redirects to /pricing. If the file does not exist
 * (audio generation failed that day), returns 404.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date", { status: 400 });
  }

  // ── Rate limit: 60 audio requests per minute per IP ─────────────
  // The endpoint redirects to a 1h signed URL, so real listeners
  // typically hit this once per session. 60/min is extremely
  // generous for legitimate use but blocks scraping.
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`audio:ip:${ip}`, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!ipLimit.ok) {
    return rateLimitResponse(ipLimit.retryAfter);
  }

  const supabase = createServiceClient();

  // ── Auth path 1: Session cookie ──────────────────────────────────
  let email: string | undefined;

  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const cookieEmail = parsed.email?.trim().toLowerCase();
      const cookieToken = parsed.token;

      if (cookieEmail && cookieToken) {
        const { data: session } = await supabase
          .from("verification_codes")
          .select("id")
          .eq("email", cookieEmail)
          .eq("code", `session:${cookieToken}`)
          .eq("used", false)
          .gte("expires_at", new Date().toISOString())
          .limit(1)
          .maybeSingle();

        if (session) email = cookieEmail;
      }
    } catch { /* invalid cookie — fall through */ }
  }

  // ── Auth path 2: Magic link token via query params ───────────────
  if (!email) {
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token")?.trim();
    const queryEmail = url.searchParams.get("email")?.trim().toLowerCase();

    if (queryToken && queryEmail && queryToken.length >= 32) {
      const { data: magicToken } = await supabase
        .from("verification_codes")
        .select("id")
        .eq("email", queryEmail)
        .eq("code", `magic:${queryToken}`)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (magicToken) email = queryEmail;
    }
  }

  // ── No valid auth → redirect to pricing ──────────────────────────
  if (!email) {
    return Response.redirect(new URL("/pricing", req.url));
  }

  // ── Check subscriber tier ────────────────────────────────────────
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("tier")
    .eq("email", email)
    .maybeSingle();

  if (subscriber?.tier !== "pro") {
    return Response.redirect(new URL("/pricing", req.url));
  }

  // ── Pro user: generate signed URL for the MP3 ────────────────────
  const { data, error } = await supabase.storage
    .from("briefing-audio")
    .createSignedUrl(`${date}.mp3`, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    return new Response("Audio not found", { status: 404 });
  }

  return Response.redirect(data.signedUrl);
}
