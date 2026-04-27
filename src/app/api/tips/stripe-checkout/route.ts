import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson, tipStripeCheckoutSchema } from "@/lib/validation";
import { createTipCheckoutSession } from "@/lib/stripe";

export async function POST(request: Request) {
  // ── Rate limit: 10 checkout sessions per minute per IP ───────────────
  // Mirrors /api/tips/invoice. Stripe also rate-limits at their end, but
  // we don't want bots spamming pending stripe_tips rows either.
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`tips-stripe:ip:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfter);
  }

  // ── Input validation ─────────────────────────────────────────────────
  const parsed = await parseJson(tipStripeCheckoutSchema, request);
  if (!parsed.ok) return parsed.response;

  const { amount_cents, tipper_email, tipper_name, message, source, briefing_date } = parsed.data;
  const cleanName = tipper_name.trim();
  const cleanMessage = message?.trim() || null;

  // ── Persist pending row first so we can pass tip_id to Stripe ────────
  // tipper_email is captured upfront (rather than waiting for the webhook
  // to surface session.customer_details.email) so a branded receipt can
  // still be sent even if Stripe's webhook drops the customer block.
  const supabase = createServiceClient();
  const { data: row, error: insertError } = await supabase
    .from("stripe_tips")
    .insert({
      amount_cents,
      currency: "usd",
      tipper_email,
      tipper_name: cleanName,
      message: cleanMessage,
      briefing_date: briefing_date ?? null,
      source,
    })
    .select("id")
    .maybeSingle();

  if (insertError || !row?.id) {
    return NextResponse.json(
      { success: false, error: "Could not record tip intent" },
      { status: 500 }
    );
  }

  // ── Create the Stripe Checkout Session ────────────────────────────────
  const session = await createTipCheckoutSession({
    tipId: row.id,
    amountCents: amount_cents,
    tipperEmail: tipper_email,
    tipperName: cleanName,
    message: cleanMessage,
    briefingDate: briefing_date ?? null,
    source,
  });

  if (session.error || !session.data) {
    return NextResponse.json(
      { success: false, error: session.error ?? "Could not create checkout" },
      { status: 502 }
    );
  }

  // ── Backfill the session id so the webhook can also reconcile by it ──
  // Best-effort: if this fails, metadata.tip_id still works for reconciliation.
  await supabase
    .from("stripe_tips")
    .update({ stripe_session_id: session.data.sessionId })
    .eq("id", row.id);

  return NextResponse.json({
    success: true,
    url: session.data.url,
    session_id: session.data.sessionId,
  });
}
