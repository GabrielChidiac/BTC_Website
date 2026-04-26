import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { paymentHashSchema } from "@/lib/validation";
import { getInvoiceStatus } from "@/lib/lightning";

/**
 * Poll endpoint. Frontend hits this every ~2-3 seconds while waiting on a
 * tip payment. Returns `{ paid: boolean }` plus amount on confirmation.
 *
 * Trusts the DB cache once paid — never un-flips a confirmed tip.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> }
) {
  // ── Rate limit: 60 status polls per minute per IP ────────────────────
  // One tipper polls ~30 times per invoice (2s × 60s); bucket sized so a
  // single bad actor cannot DoS CoinOS through us, but normal flow never
  // trips it.
  const ip = getClientIp(request);
  const limit = await checkRateLimit(`tips-status:ip:${ip}`, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return rateLimitResponse(limit.retryAfter);
  }

  const { hash: rawHash } = await params;
  const parsed = paymentHashSchema.safeParse(rawHash);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid payment hash" },
      { status: 400 }
    );
  }
  const paymentHash = parsed.data.toLowerCase();

  const supabase = createServiceClient();

  // ── Fast path: row already marked paid in our DB ─────────────────────
  const { data: row } = await supabase
    .from("lightning_tips")
    .select("paid, amount_sats, expires_at")
    .eq("payment_hash", paymentHash)
    .maybeSingle();

  if (!row) {
    return NextResponse.json(
      { success: false, error: "Invoice not found" },
      { status: 404 }
    );
  }

  if (row.paid) {
    return NextResponse.json({
      success: true,
      paid: true,
      amount_sats: row.amount_sats,
    });
  }

  // ── Slow path: ask CoinOS ────────────────────────────────────────────
  const status = await getInvoiceStatus(paymentHash);
  if (status.error || !status.data) {
    return NextResponse.json({
      success: true,
      paid: false,
      amount_sats: row.amount_sats,
    });
  }

  if (status.data.paid) {
    await supabase
      .from("lightning_tips")
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq("payment_hash", paymentHash)
      .eq("paid", false);

    return NextResponse.json({
      success: true,
      paid: true,
      amount_sats: row.amount_sats,
    });
  }

  return NextResponse.json({
    success: true,
    paid: false,
    amount_sats: row.amount_sats,
  });
}
