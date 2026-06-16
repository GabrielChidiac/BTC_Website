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

  // ── Fallback: Kie.ai (OpenAI-compatible), up to 2 attempts ──────────────
  const kieBackoffs = [0, 1000]; // first immediate, then 1s
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
      const res = await fetchWithTimeout("https://api.kie.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kieKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          messages: [
            { role: "system", content: params.system },
            { role: "user", content: params.prompt },
          ],
          max_tokens: maxTokens,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        lastKieError = `Kie.ai returned ${res.status}: ${body.slice(0, 200)}`;
        const isLastAttempt = attempt === kieBackoffs.length - 1;
        console.warn(`[anthropic] Kie.ai attempt ${attempt + 1}/${kieBackoffs.length} failed: ${lastKieError}${isLastAttempt ? "" : " — retrying"}`);
        continue;
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      lastProviderUsed = "kieai";
      console.warn(`[anthropic] Shipped via Kie.ai fallback (primary was: ${lastAnthropicError})`);
      return { data: text, error: null };
    } catch (e) {
      const err = e as Error;
      lastKieError = `${err.name}: ${err.message}`;
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
    return { data: JSON.parse(result.data!), error: null };
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
    return { data: JSON.parse(retryResult.data!), error: null };
  } catch (e) {
    return { data: null, error: `[anthropic] Failed to parse JSON after retry: ${(e as Error).message}` };
  }
}

// Lightweight canary that confirms CLAUDE_MODEL is still served by Anthropic.
// Distinguishes a retired/invalid model (404 not_found_error) from transient
// errors so the model-preflight task can alert loudly on a retirement without
// crying wolf on a network blip or rate limit. Makes the smallest possible
// billable call (4 output tokens). Used only by the preflight cron, never the
// hot pipeline path.
export async function pingModel(): Promise<
  { ok: true } | { ok: false; retired: boolean; detail: string }
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
    // 404 from Anthropic = model id not found = retired/invalid. Anything else
    // (429, 5xx, network) is transient and must not trigger a retirement alert.
    const retired = err.status === 404;
    return { ok: false, retired, detail: `${err.status ?? "?"}: ${err.message}` };
  }
}
