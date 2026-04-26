import type { Result } from "@/lib/types";

/**
 * CoinOS API wrapper for Lightning tip invoice generation and status polling.
 *
 * Auth: long-lived session JWT from `https://coinos.io` (stored in
 * `COINOS_API_TOKEN`). Sent as `Authorization: Bearer <token>`. The token
 * expires when the CoinOS session ends; on production 401s, log into
 * coinos.io fresh and rotate the env var.
 *
 * All functions return `Result<T>` and never throw, matching the project's
 * API-wrapper convention. Failures degrade to `{ data: null, error: "..." }`.
 */

const COINOS_BASE = "https://coinos.io/api";
const INVOICE_TIMEOUT_MS = 8_000;
const STATUS_TIMEOUT_MS = 5_000;

export interface CreatedInvoice {
  paymentHash: string;
  bolt11: string;
  amountSats: number;
  expiresAt: string; // ISO timestamp
}

export interface InvoiceStatus {
  paid: boolean;
  amountSats: number;
}

function getToken(): string | null {
  const token = process.env.COINOS_API_TOKEN;
  return token && token.length > 0 ? token : null;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Create a Lightning invoice on the CoinOS account. Returns a BOLT11 string
 * the frontend renders as a QR code, plus the payment hash used for polling.
 *
 * Memo is stored on the invoice metadata and visible to the payer's wallet.
 * Keep it short (CoinOS truncates at ~256 chars; we cap at 200 in the route).
 */
export async function createTipInvoice(
  amountSats: number,
  memo: string,
): Promise<Result<CreatedInvoice>> {
  const token = getToken();
  if (!token) {
    return { data: null, error: "Lightning tips not configured" };
  }
  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    return { data: null, error: "Invalid amount" };
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${COINOS_BASE}/invoice`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          invoice: {
            amount: amountSats,
            type: "lightning",
            prompt: false,
            memo,
          },
        }),
      },
      INVOICE_TIMEOUT_MS,
    );
  } catch {
    return { data: null, error: "Lightning provider unreachable" };
  }

  if (!res.ok) {
    return {
      data: null,
      error: res.status === 401 ? "Lightning auth expired" : "Invoice creation failed",
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { data: null, error: "Invalid response from Lightning provider" };
  }

  if (!body || typeof body !== "object") {
    return { data: null, error: "Invalid response from Lightning provider" };
  }
  const obj = body as Record<string, unknown>;

  // CoinOS returns the BOLT11 string under `text` (and confusingly mirrors
  // the same string under `hash`). The actual Lightning payment hash lives
  // under `paymentHash` (camelCase) — that's what we use for polling.
  const bolt11 = typeof obj.text === "string" ? obj.text : null;
  const paymentHash =
    typeof obj.paymentHash === "string" ? obj.paymentHash : null;
  const expirySeconds =
    typeof obj.expiry === "number" && obj.expiry > 0 ? obj.expiry : 600;

  if (!bolt11 || !paymentHash) {
    return { data: null, error: "Malformed invoice response" };
  }

  return {
    data: {
      paymentHash,
      bolt11,
      amountSats,
      expiresAt: new Date(Date.now() + expirySeconds * 1000).toISOString(),
    },
    error: null,
  };
}

/**
 * Check whether a previously-created invoice has been paid. Used by the
 * frontend polling loop on /tip. Returns `paid: false` while waiting and
 * `paid: true` once CoinOS confirms settlement.
 */
export async function getInvoiceStatus(
  paymentHash: string,
): Promise<Result<InvoiceStatus>> {
  const token = getToken();
  if (!token) {
    return { data: null, error: "Lightning tips not configured" };
  }
  if (!paymentHash || paymentHash.length < 16) {
    return { data: null, error: "Invalid payment hash" };
  }

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${COINOS_BASE}/invoice/${encodeURIComponent(paymentHash)}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
      STATUS_TIMEOUT_MS,
    );
  } catch {
    return { data: null, error: "Lightning provider unreachable" };
  }

  if (!res.ok) {
    return {
      data: null,
      error: res.status === 404 ? "Invoice not found" : "Status check failed",
    };
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return { data: null, error: "Invalid response from Lightning provider" };
  }

  if (!body || typeof body !== "object") {
    return { data: null, error: "Invalid response from Lightning provider" };
  }
  const obj = body as Record<string, unknown>;

  // CoinOS settlement signal: `received` is the sats credited to the
  // invoice. Zero (or missing) means unpaid. Lightning payments are atomic
  // so any non-zero value means the invoice was settled in full.
  const received = typeof obj.received === "number" ? obj.received : 0;
  const amountSats = typeof obj.amount === "number" ? obj.amount : 0;

  return { data: { paid: received > 0, amountSats }, error: null };
}
