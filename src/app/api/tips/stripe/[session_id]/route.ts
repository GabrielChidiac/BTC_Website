import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { stripeSessionIdSchema } from "@/lib/validation";

interface RouteContext {
  params: Promise<{ session_id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  // ── Rate limit: 30 polls per minute per IP ───────────────────────────
  // /tip/thanks polls 3 times max per user, but be defensive against the
  // page being kept open in a tab.
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`tips-stripe-status:ip:${ip}`, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfter);
  }

  const { session_id } = await context.params;
  const sessionIdResult = stripeSessionIdSchema.safeParse(session_id);
  if (!sessionIdResult.success) {
    return NextResponse.json(
      { success: false, error: "Invalid session id" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: row } = await supabase
    .from("stripe_tips")
    .select("paid, amount_cents, currency")
    .eq("stripe_session_id", sessionIdResult.data)
    .maybeSingle();

  if (!row) {
    return NextResponse.json(
      { success: false, error: "Not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    paid: row.paid,
    amount_cents: row.amount_cents,
    currency: row.currency,
  });
}
