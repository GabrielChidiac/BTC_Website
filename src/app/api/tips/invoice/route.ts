import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson, tipInvoiceSchema } from "@/lib/validation";
import { createTipInvoice } from "@/lib/lightning";

export async function POST(request: Request) {
  // ── Rate limit: 10 invoice generations per minute per IP ─────────────
  // Protects against bots minting thousands of invoices to crowd out
  // the CoinOS account or fill our DB. Generous enough that one tipper
  // who taps "regenerate" a few times never trips it.
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`tips:ip:${ip}`, {
    limit: 10,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfter);
  }

  // ── Input validation ─────────────────────────────────────────────────
  const parsed = await parseJson(tipInvoiceSchema, request);
  if (!parsed.ok) return parsed.response;

  const { amount_sats, tipper_name, message, source, briefing_date } = parsed.data;
  const cleanName = tipper_name?.trim() || null;
  const cleanMessage = message?.trim() || null;

  // ── Create invoice on CoinOS ─────────────────────────────────────────
  // Prefix with name when provided so it shows up in the CoinOS dashboard
  // and (depending on the tipper's wallet) in their payment receipt.
  const memoParts = ["BTC Today tip"];
  if (cleanName) memoParts.push(`from ${cleanName}`);
  if (cleanMessage) memoParts.push(`: ${cleanMessage}`);
  const memo = memoParts.join(cleanMessage ? " " : " ");

  const invoice = await createTipInvoice(amount_sats, memo);
  if (invoice.error || !invoice.data) {
    return NextResponse.json(
      { success: false, error: invoice.error ?? "Could not create invoice" },
      { status: 502 }
    );
  }

  // ── Persist tracking row (best-effort; payment is the source of truth) ─
  // If this insert fails, the invoice still works on CoinOS — the user
  // can pay and the funds land. We just lose attribution. Logging the
  // failure here would leak the payment hash to Vercel logs, so we stay
  // silent and let polling reconcile from CoinOS on the next status check.
  const supabase = createServiceClient();
  await supabase.from("lightning_tips").insert({
    payment_hash: invoice.data.paymentHash,
    bolt11: invoice.data.bolt11,
    amount_sats: invoice.data.amountSats,
    tipper_name: cleanName,
    message: cleanMessage,
    briefing_date: briefing_date ?? null,
    source,
    expires_at: invoice.data.expiresAt,
  });

  return NextResponse.json({
    success: true,
    payment_hash: invoice.data.paymentHash,
    bolt11: invoice.data.bolt11,
    amount_sats: invoice.data.amountSats,
    expires_at: invoice.data.expiresAt,
  });
}
