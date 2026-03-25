import Anthropic from "@anthropic-ai/sdk";
import type { Result } from "@/lib/types";

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

    const res = await fetch("https://api.kie.ai/v1/chat/completions", {
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

export async function callClaudeJSON<T>(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<Result<T>> {
  const result = await callClaude(params);
  if (result.error) return { data: null, error: result.error };

  // ── First parse attempt ─────────────────────────────────────────────────
  try {
    const parsed = JSON.parse(result.data!) as T;
    return { data: parsed, error: null };
  } catch {
    // Fall through to retry
  }

  // ── Retry with "fix your JSON" prompt ───────────────────────────────────
  const retryResult = await callClaude({
    system: params.system,
    prompt: `${result.data}\n\nYour previous response was not valid JSON. Please return ONLY valid JSON, no markdown fences or extra text.`,
    maxTokens: params.maxTokens,
  });

  if (retryResult.error) return { data: null, error: retryResult.error };

  try {
    const parsed = JSON.parse(retryResult.data!) as T;
    return { data: parsed, error: null };
  } catch (e) {
    return { data: null, error: `[anthropic] Failed to parse JSON after retry: ${(e as Error).message}` };
  }
}
