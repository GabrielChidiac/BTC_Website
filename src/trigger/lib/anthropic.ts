import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { Result } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-timeout";

export async function callClaude(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<Result<string>> {
  const maxTokens = params.maxTokens ?? 8192;

  // ── Primary: Anthropic SDK ──────────────────────────────────────────────
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    return { data: text, error: null };
  } catch (primaryError) {
    const err = primaryError as Error & { status?: number };
    const status = err.status ?? 0;
    const isRetryable = status === 429 || status >= 500;

    if (!isRetryable) {
      return { data: null, error: `[anthropic] ${err.message}` };
    }

    console.warn(`[anthropic] Primary failed (${status}), falling back to Kie.ai`);
  }

  // ── Fallback: Kie.ai (OpenAI-compatible) ────────────────────────────────
  try {
    const kieKey = process.env.KIE_API_KEY;
    if (!kieKey) {
      return { data: null, error: "[anthropic] KIE_API_KEY env var is not set for fallback" };
    }

    const res = await fetchWithTimeout("https://api.kie.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${kieKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.prompt },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { data: null, error: `[anthropic] Kie.ai fallback failed (${res.status}): ${body}` };
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    return { data: text, error: null };
  } catch (e) {
    return { data: null, error: `[anthropic] Both primary and fallback failed: ${(e as Error).message}` };
  }
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
}): Promise<Result<T>> {
  const { schema, retryOnSchemaError = false } = params;

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
  const correctionRetry = await callClaude({
    system: params.system,
    prompt: `${params.prompt}\n\n---\n\nYour previous response parsed as JSON but failed schema validation. Issues found:\n${issues}\n\nReturn ONLY corrected JSON matching the exact shape. No markdown fences, no extra text.`,
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
