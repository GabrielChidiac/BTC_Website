import { PERPLEXITY_BASE } from "@/lib/constants";
import type { Result } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-timeout";

export async function queryPerplexity(params: {
  system: string;
  prompt: string;
}): Promise<Result<string>> {
  try {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) {
      return { data: null, error: "[perplexity] PERPLEXITY_API_KEY env var is not set" };
    }

    const res = await fetchWithTimeout(PERPLEXITY_BASE, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { data: null, error: `[perplexity] API returned ${res.status}: ${body}` };
    }

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text.trim()) {
      return { data: null, error: "[perplexity] API returned empty response" };
    }
    return { data: text, error: null };
  } catch (e) {
    return { data: null, error: `[perplexity] ${(e as Error).message}` };
  }
}
