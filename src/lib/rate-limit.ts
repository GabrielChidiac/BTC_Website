import { createServiceClient } from "@/lib/supabase/server";

/**
 * Rate limiter backed by the `rate_limits` Postgres table and the
 * `increment_rate_limit` RPC (see 20260414000000_rate_limits.sql).
 *
 * Philosophy: FAIL OPEN on limiter errors. If Supabase is unreachable or
 * the RPC errors, we let the request through rather than locking every
 * legitimate user out on a transient blip. The underlying routes still
 * have authentication/HMAC/token gates that stop abuse at a second layer.
 *
 * Usage:
 *   const ip = getClientIp(req);
 *   const { ok, retryAfter } = await checkRateLimit(
 *     `subscribe:ip:${ip}`,
 *     { limit: 5, windowSeconds: 60 }
 *   );
 *   if (!ok) return rateLimitResponse(retryAfter);
 */

export interface RateLimitOptions {
  /** Max number of requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Post-increment count for this window. Zero on fail-open. */
  count: number;
  /** Seconds to wait before the next request is guaranteed to pass. */
  retryAfter: number;
}

/**
 * Atomically increment the bucket's counter for the current window and
 * return whether the caller is still under the limit.
 */
export async function checkRateLimit(
  bucket: string,
  { limit, windowSeconds }: RateLimitOptions
): Promise<RateLimitResult> {
  if (!bucket) {
    // Defensive: an empty bucket string would collapse all callers into
    // one row. Always fail open in that case rather than silently share.
    return { ok: true, count: 0, retryAfter: 0 };
  }

  const nowMs = Date.now();
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs).toISOString();
  const retryAfter = Math.ceil((windowStartMs + windowMs - nowMs) / 1000);

  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc("increment_rate_limit", {
      p_bucket: bucket,
      p_window: windowStart,
    });

    if (error || typeof data !== "number") {
      // Fail open: never block users on a limiter-internal error.
      return { ok: true, count: 0, retryAfter: 0 };
    }

    return {
      ok: data <= limit,
      count: data,
      retryAfter: data > limit ? retryAfter : 0,
    };
  } catch {
    return { ok: true, count: 0, retryAfter: 0 };
  }
}

/**
 * Extract the best-effort client IP from a Next.js request. Vercel and
 * most reverse proxies set `x-forwarded-for` (comma-separated list, first
 * entry is the origin client). Falls back to `x-real-ip`, then "unknown".
 * "unknown" is a shared bucket across all unknowable callers, which means
 * a single bad actor cannot monopolize it without also hurting other bots
 * that also lack a known IP. Legitimate traffic always has a forwarded
 * header in production.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

/**
 * Standard 429 response with Retry-After header. Callers can use this
 * directly or construct their own response with additional context.
 */
export function rateLimitResponse(retryAfter: number, message?: string): Response {
  return new Response(
    JSON.stringify({
      error: message ?? "Too many requests. Please try again in a moment.",
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, retryAfter)),
      },
    }
  );
}
