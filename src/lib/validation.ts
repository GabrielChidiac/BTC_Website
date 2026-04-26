import { z } from "zod";

/**
 * Shared zod schemas for public API routes. Every route that accepts user
 * input should parse its body with one of these schemas before touching
 * the database. Defence-in-depth on top of the existing manual checks:
 *
 *   - Rejects unknown/extra fields (`.strict()`) so attackers cannot
 *     smuggle columns into upserts.
 *   - Applies the same lowercasing/trimming pipeline every route used to
 *     do ad-hoc, in one place.
 *   - Gives every route a uniform 400 response via `parseJson(schema, req)`.
 */

const EMAIL_MAX = 254;
const NAME_MAX = 50;

/** RFC-5322-ish email. The manual regex in src/lib/constants.ts is stricter on
 *  local-part rules than zod's `.email()`, so we keep both checks in series. */
const emailBase = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .max(EMAIL_MAX, "Email is too long")
  .email("Invalid email");

const nameBase = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(NAME_MAX, `Name must be ${NAME_MAX} characters or fewer`);

/** POST /api/subscribe */
export const subscribeSchema = z
  .object({
    email: emailBase,
    name: nameBase,
    // Honeypot — must be empty or missing. If a bot fills it we accept
    // the payload but skip processing at the route layer.
    website: z.string().max(0).optional().or(z.literal("").optional()),
  })
  .strict();

/** POST /api/subscribe/verify */
export const subscribeVerifySchema = z
  .object({
    email: emailBase,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Code must be 6 digits"),
  })
  .strict();

/** POST /api/auth/verify-send */
export const verifySendSchema = z
  .object({
    email: emailBase,
  })
  .strict();

/** POST /api/auth/verify-check */
export const verifyCheckSchema = z
  .object({
    email: emailBase,
    token: z
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/, "Invalid token format"),
  })
  .strict();

/** Date path parameter on /pdf/[date], /api/audio/[date], etc. */
export const dateParamSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format");

/** POST /api/tips/invoice — create a Lightning tip invoice */
export const tipInvoiceSchema = z
  .object({
    amount_sats: z
      .number()
      .int("Amount must be a whole number of sats")
      .min(21, "Minimum tip is 21 sats")
      .max(1_000_000, "Maximum tip is 1,000,000 sats"),
    tipper_name: z
      .string()
      .trim()
      .max(80, "Name must be 80 characters or fewer")
      .optional(),
    message: z
      .string()
      .trim()
      .max(200, "Message must be 200 characters or fewer")
      .optional(),
    source: z
      .enum(["site", "newsletter", "archive", "footer"])
      .default("site"),
    briefing_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
      .optional(),
  })
  .strict();

/** Path parameter on /api/tips/[hash] — CoinOS payment hash */
export const paymentHashSchema = z
  .string()
  .regex(/^[a-f0-9]{32,128}$/i, "Invalid payment hash");

/**
 * Parse a Request JSON body with a zod schema. Returns either the parsed
 * data or a ready-to-return 400 Response. Handles malformed JSON, missing
 * bodies, and schema violations uniformly.
 */
export async function parseJson<T extends z.ZodTypeAny>(
  schema: T,
  req: Request
): Promise<
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: Response }
> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: "Invalid JSON body" }),
        { status: 400, headers: { "content-type": "application/json" } }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const message = issue?.message ?? "Invalid request";
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 400, headers: { "content-type": "application/json" } }
      ),
    };
  }

  return { ok: true, data: result.data };
}
