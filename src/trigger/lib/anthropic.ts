import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { Result } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-timeout";

// Exposed so the pipeline can log which provider shipped each day. Updated
// at the end of each `callClaude` invocation. Not thread-safe across concurrent
// calls, but the pipeline runs Claude calls sequentially, so this is fine.
export let lastProviderUsed: "anthropic" | "kieai" | null = null;

// Single source of truth for the Claude model. Used for BOTH the Anthropic SDK
// call and the Kie.ai fallback (Kie.ai proxies the same model name). When a
// model is retired, both providers 404 simultaneously — update this one
// constant. Retirement dates are published in Anthropic's migration guide;
// `claude-sonnet-4-20250514` retired 2026-06-15 and was replaced here.
export const CLAUDE_MODEL = "claude-sonnet-4-6";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// A failure mode is "retryable" when it's transient — rate limits, 5xx, network
// errors, timeouts. Permanent errors (auth, bad request) return false so we
// fall through to the Kie.ai fallback immediately instead of wasting retries.
function isRetryableError(err: Error & { status?: number; name?: string }): boolean {
  const status = err.status ?? 0;
  if (status === 429 || status >= 500) return true;
  if (err.name === "AbortError") return true;
  if (err.name === "TimeoutError") return true;
  const msg = err.message?.toLowerCase() ?? "";
  if (msg.includes("timeout") || msg.includes("timed out")) return true;
  if (msg.includes("econnreset") || msg.includes("econnrefused")) return true;
  if (msg.includes("enotfound") || msg.includes("network")) return true;
  if (msg.includes("fetch failed")) return true;
  return false;
}

// ── Kie.ai fallback transport ────────────────────────────────────────────
// Verified 2026-10-06: the old OpenAI-style `/v1/chat/completions` path
// answers HTTP 200 with `{"code":422,"msg":"The model is not supported"}`, so
// the fallback was silently dead. The working path is the Anthropic-native
// `/claude/v1/messages`. Two quirks:
//  1. Kie.ai IGNORES the `system` field (it injects its own prompt), so the
//     system prompt is folded into the user turn.
//  2. Errors can arrive as HTTP 200 with a `code`/`error` body, so success is
//     decided by the presence of text content, never by `res.ok` alone.
const KIE_MESSAGES_URL = "https://api.kie.ai/claude/v1/messages";
const KIE_CREDIT_URL = "https://api.kie.ai/api/v1/chat/credit";
// Kie.ai's gateway returns HTTP 500 at ~111s regardless of progress
// (verified 2026-10-06, streaming too). Our own timeout sits just above it.
const KIE_TIMEOUT_MS = 150_000;
// Errors arriving after this long are treated as that gateway cutoff.
const KIE_GATEWAY_CUTOFF_HINT_MS = 90_000;

async function kieMessages(
  key: string,
  params: { system?: string; prompt: string; maxTokens: number; timeoutMs?: number },
): Promise<Result<string>> {
  // Plain headings, not an XML tag: Kie.ai's injected prompt makes the model
  // treat `<system_instructions>`-style wrappers as possible prompt injection.
  const userContent = params.system
    ? `# Role and output contract\n${params.system}\n\n# Task\n${params.prompt}`
    : params.prompt;
  const res = await fetchWithTimeout(
    KIE_MESSAGES_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: params.maxTokens,
        messages: [{ role: "user", content: userContent }],
      }),
    },
    params.timeoutMs ?? KIE_TIMEOUT_MS,
  );
  const raw = await res.text();
  let json: {
    content?: Array<{ type?: string; text?: string }>;
    code?: number;
    msg?: string;
    error?: { message?: string };
  } | null = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // fall through: non-JSON body is an error
  }
  const text = (json?.content ?? [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
  if (res.ok && text.trim()) return { data: text, error: null };
  const reason = json?.error?.message ?? json?.msg ?? raw.slice(0, 200);
  return {
    data: null,
    error: `Kie.ai HTTP ${res.status}${json?.code ? ` code ${json.code}` : ""}: ${reason}`,
  };
}

export async function callClaude(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<Result<string>> {
  const maxTokens = params.maxTokens ?? 8192;
  lastProviderUsed = null;

  // ── Primary: Anthropic SDK, up to 3 attempts with exponential backoff ──
  const anthropicBackoffs = [0, 1000, 3000]; // first attempt immediate, then 1s, 3s (total ~4s added)
  let lastAnthropicError: string = "no attempt made";

  for (let attempt = 0; attempt < anthropicBackoffs.length; attempt++) {
    if (anthropicBackoffs[attempt] > 0) await sleep(anthropicBackoffs[attempt]);
    try {
      const client = new Anthropic();
      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: maxTokens,
        system: params.system,
        messages: [{ role: "user", content: params.prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      lastProviderUsed = "anthropic";
      return { data: text, error: null };
    } catch (primaryError) {
      const err = primaryError as Error & { status?: number; name?: string };
      lastAnthropicError = `${err.name ?? "Error"}${err.status ? ` (${err.status})` : ""}: ${err.message}`;

      if (!isRetryableError(err)) {
        // Permanent error — do not retry Anthropic, fall straight to Kie.ai
        console.warn(`[anthropic] Non-retryable error on attempt ${attempt + 1}, falling back to Kie.ai: ${lastAnthropicError}`);
        break;
      }

      const isLastAttempt = attempt === anthropicBackoffs.length - 1;
      console.warn(`[anthropic] Attempt ${attempt + 1}/${anthropicBackoffs.length} failed: ${lastAnthropicError}${isLastAttempt ? " — falling back to Kie.ai" : " — retrying"}`);
    }
  }

  // ── Fallback: Kie.ai (Anthropic-native), up to 3 attempts ───────────────
  // Kie.ai rate-limits back-to-back calls (429 seen at 1s spacing on
  // 2026-10-06), so the backoff is deliberately wide.
  const kieBackoffs = [0, 5000, 15000];
  let lastKieError: string = "no attempt made";

  const kieKey = process.env.KIE_API_KEY;
  if (!kieKey) {
    return {
      data: null,
      error: `[anthropic] Anthropic failed (${lastAnthropicError}) and KIE_API_KEY is not set for fallback`,
    };
  }

  for (let attempt = 0; attempt < kieBackoffs.length; attempt++) {
    if (kieBackoffs[attempt] > 0) await sleep(kieBackoffs[attempt]);
    try {
      const startedAt = Date.now();
      const res = await kieMessages(kieKey, {
        system: params.system,
        prompt: params.prompt,
        maxTokens,
      });

      if (res.error) {
        lastKieError = res.error;
        // A failure after a long wait is Kie.ai's ~111s gateway cutoff: the
        // same request will time out again. Retrying would burn ~2 min per
        // attempt and could push the Synthesizer task past maxDuration (a
        // hard pipeline failure, worse than the data-only fallback). Stop.
        if (Date.now() - startedAt > KIE_GATEWAY_CUTOFF_HINT_MS) {
          console.warn(`[anthropic] Kie.ai gateway timeout (${Math.round((Date.now() - startedAt) / 1000)}s), not retrying: ${lastKieError}`);
          break;
        }
        const isLastAttempt = attempt === kieBackoffs.length - 1;
        console.warn(`[anthropic] Kie.ai attempt ${attempt + 1}/${kieBackoffs.length} failed: ${lastKieError}${isLastAttempt ? "" : " — retrying"}`);
        continue;
      }

      const text = res.data ?? "";
      lastProviderUsed = "kieai";
      console.warn(`[anthropic] Shipped via Kie.ai fallback (primary was: ${lastAnthropicError})`);
      return { data: text, error: null };
    } catch (e) {
      const err = e as Error;
      lastKieError = `${err.name}: ${err.message}`;
      if (err.name === "AbortError") {
        // Our own 150s timeout fired: same reasoning as the gateway cutoff.
        console.warn(`[anthropic] Kie.ai timed out, not retrying: ${lastKieError}`);
        break;
      }
      const isLastAttempt = attempt === kieBackoffs.length - 1;
      console.warn(`[anthropic] Kie.ai attempt ${attempt + 1}/${kieBackoffs.length} threw: ${lastKieError}${isLastAttempt ? "" : " — retrying"}`);
    }
  }

  return {
    data: null,
    error: `[anthropic] Both providers exhausted. Anthropic: ${lastAnthropicError}. Kie.ai: ${lastKieError}.`,
  };
}

// Extract a short, actionable summary of zod validation failures so the
// correction-retry prompt can quote them back to Claude.
function summarizeZodIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map((issue) => `- ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

export async function callClaudeJSON<T>(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
  // Any zod schema. The caller asserts T matches the schema's output type.
  schema?: z.ZodTypeAny;
  // Set true for fatal tasks (AI brain) so a schema-correction retry fires
  // before erroring. Non-fatal tasks leave this false to save tokens.
  retryOnSchemaError?: boolean;
  // Optional: a prior valid response (e.g. yesterday's briefing) prepended
  // to the correction-retry prompt so the model can anchor its output shape
  // on a known-good example. Useful for complex schemas on degraded models.
  correctionExample?: string;
}): Promise<Result<T>> {
  const { schema, retryOnSchemaError = false, correctionExample } = params;

  // ── Step 1: initial call + JSON.parse (with existing fix-your-JSON retry)
  const firstText = await callClaudeWithJsonRetry(params);
  if (firstText.error) return { data: null, error: firstText.error };

  const parsed = firstText.data!;

  // ── Step 2: schema validation (if schema provided)
  if (!schema) {
    return { data: parsed as T, error: null };
  }

  const firstValidation = schema.safeParse(parsed);
  if (firstValidation.success) {
    return { data: firstValidation.data as T, error: null };
  }

  // ── Step 3: optional schema-correction retry (fatal tasks only)
  if (!retryOnSchemaError) {
    return {
      data: null,
      error: `[anthropic] schema validation failed: ${summarizeZodIssues(firstValidation.error)}`,
    };
  }

  const issues = summarizeZodIssues(firstValidation.error);
  const examplePreamble = correctionExample
    ? `A VALID REFERENCE RESPONSE (use as a shape anchor, do NOT copy content):\n${correctionExample}\n\n---\n\n`
    : "";
  const correctionRetry = await callClaude({
    system: params.system,
    prompt: `${examplePreamble}${params.prompt}\n\n---\n\nYour previous response parsed as JSON but failed schema validation. Issues found:\n${issues}\n\nReturn ONLY corrected JSON matching the exact shape. No markdown fences, no extra text.`,
    maxTokens: params.maxTokens,
  });

  if (correctionRetry.error) return { data: null, error: correctionRetry.error };

  let retryParsed: unknown;
  try {
    retryParsed = JSON.parse(correctionRetry.data!);
  } catch (e) {
    return {
      data: null,
      error: `[anthropic] schema-correction retry returned invalid JSON: ${(e as Error).message}`,
    };
  }

  const secondValidation = schema.safeParse(retryParsed);
  if (secondValidation.success) {
    return { data: secondValidation.data as T, error: null };
  }

  return {
    data: null,
    error: `[anthropic] schema validation failed after correction retry: ${summarizeZodIssues(secondValidation.error)}`,
  };
}

// Models (especially via Kie.ai) sometimes wrap JSON in ```json fences despite
// instructions. Strip one leading/trailing fence pair before parsing.
function stripJsonFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

// Helper that wraps the existing callClaude + JSON.parse + fix-your-JSON retry
// flow, returning the parsed object (not yet schema-validated).
async function callClaudeWithJsonRetry(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<Result<unknown>> {
  const result = await callClaude(params);
  if (result.error) return { data: null, error: result.error };

  try {
    return { data: JSON.parse(stripJsonFences(result.data!)), error: null };
  } catch {
    // Fall through to retry
  }

  const retryResult = await callClaude({
    system: params.system,
    prompt: `${result.data}\n\nYour previous response was not valid JSON. Please return ONLY valid JSON, no markdown fences or extra text.`,
    maxTokens: params.maxTokens,
  });

  if (retryResult.error) return { data: null, error: retryResult.error };

  try {
    return { data: JSON.parse(stripJsonFences(retryResult.data!)), error: null };
  } catch (e) {
    return { data: null, error: `[anthropic] Failed to parse JSON after retry: ${(e as Error).message}` };
  }
}

// Why a canary failed. Only "transient" is safe to ignore; every other kind
// means tonight's briefing WILL degrade unless a human acts first.
//  - retired: 404, model id no longer served → update CLAUDE_MODEL
//  - billing: credit balance exhausted → top up / enable auto-reload
//  - auth:    401/403, key revoked or missing
//  - transient: 429/5xx/network blip
export type PingFailureKind = "retired" | "billing" | "auth" | "transient";

function classifyFailure(status: number | undefined, message: string): PingFailureKind {
  const msg = message.toLowerCase();
  if (msg.includes("credit balance") || msg.includes("billing") || msg.includes("insufficient")) {
    return "billing";
  }
  if (status === 404) return "retired";
  if (status === 401 || status === 403) return "auth";
  if (status === 400) return "billing"; // non-credit 400s on a fixed 4-token ping are account-level too
  return "transient";
}

// Lightweight canary that confirms Anthropic will serve CLAUDE_MODEL tonight.
// On 2026-10-03..06 the account ran out of credits: Anthropic returned 400
// "credit balance is too low", which the old 404-only check classed as
// transient, so four fallback briefings shipped with no specific alert.
// Makes the smallest possible billable call (4 output tokens). Used only by
// the preflight cron, never the hot pipeline path.
export async function pingModel(): Promise<
  { ok: true } | { ok: false; kind: PingFailureKind; detail: string }
> {
  try {
    const client = new Anthropic();
    await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4,
      messages: [{ role: "user", content: "Reply with: ok" }],
    });
    return { ok: true };
  } catch (e) {
    const err = e as Error & { status?: number };
    return {
      ok: false,
      kind: classifyFailure(err.status, err.message ?? ""),
      detail: `${err.status ?? "?"}: ${err.message}`,
    };
  }
}

// Same canary for the Kie.ai fallback, plus its remaining credit balance.
// The fallback rotted silently from June to October because nothing ever
// exercised it until the primary was already down.
export async function pingKie(): Promise<
  { ok: true; credits: number | null } | { ok: false; detail: string; credits: number | null }
> {
  const key = process.env.KIE_API_KEY;
  if (!key) return { ok: false, detail: "KIE_API_KEY is not set", credits: null };

  let credits: number | null = null;
  try {
    const res = await fetchWithTimeout(KIE_CREDIT_URL, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = (await res.json()) as { data?: unknown };
    if (typeof json.data === "number") credits = json.data;
  } catch {
    // credit lookup is best-effort; the message ping below is the real test
  }

  try {
    // 30s cap keeps the preflight well inside its 120s maxDuration even if Kie hangs.
    const res = await kieMessages(key, { prompt: "Reply with: ok", maxTokens: 8, timeoutMs: 30_000 });
    if (res.error) return { ok: false, detail: res.error, credits };
    return { ok: true, credits };
  } catch (e) {
    return { ok: false, detail: (e as Error).message, credits };
  }
}
