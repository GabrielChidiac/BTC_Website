import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/session";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";

const SIGNED_URL_EXPIRY = 60; // seconds

export async function GET(
  req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response("Invalid date", { status: 400 });
  }

  // ── Rate limit: 30 PDF requests per minute per IP ───────────────
  // Generous cap for legitimate download behaviour; blocks scraping.
  const ip = getClientIp(req);
  const ipLimit = await checkRateLimit(`pdf:ip:${ip}`, {
    limit: 30,
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

  // ── Pro user: generate short-lived signed URL ────────────────────
  const filename = `btc-today-${date}.pdf`;
  const { data, error } = await supabase.storage
    .from("briefing-pdfs")
    .createSignedUrl(filename, SIGNED_URL_EXPIRY);

  if (error || !data?.signedUrl) {
    return new Response("PDF not found", { status: 404 });
  }

  return Response.redirect(data.signedUrl);
}
