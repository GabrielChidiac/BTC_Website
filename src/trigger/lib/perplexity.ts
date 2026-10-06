import { PERPLEXITY_BASE } from "@/lib/constants";
import type { Result } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-timeout";

// The account's sonar-pro rate limit is tiny (`x-ratelimit-limit: 1`, verified
// 2026-10-06): a second concurrent request gets an instant 429. Before this
// retry existed, enrichment's parallel queries lost 3 of 4 calls to 429 on
// most days and silently shipped "unavailable" defaults for weeks. Callers
// should still serialize Perplexity calls; this retry is the safety net.
const MAX_ATTEMPTS = 4;
const MAX_WAIT_MS = 20_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// How long to wait after a 429. Prefers the server's own reset hint
// (`retry-after` seconds, or `x-ratelimit-reset` unix seconds), else
// exponential backoff. Clamped so one call can never eat the task budget.
function rateLimitWaitMs(res: Response, attempt: number): number {
  const retryAfter = Number(res.headers.get("retry-after"));
  const reset = Number(res.headers.get("x-ratelimit-reset"));
  let ms = 2000 * 2 ** attempt;
  if (retryAfter > 0) ms = retryAfter * 1000;
  else if (reset > 0) ms = reset * 1000 - Date.now();
  return Math.min(Math.max(ms, 1000), MAX_WAIT_MS) + Math.floor(Math.random() * 500);
}

export async function queryPerplexity(params: {
  system: string;
  prompt: string;
}): Promise<Result<string>> {
  try {
    const key = process.env.PERPLEXITY_API_KEY;
    if (!key) {
      return { data: null, error: "[perplexity] PERPLEXITY_API_KEY env var is not set" };
    }

    let res: Response | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      res = await fetchWithTimeout(
        PERPLEXITY_BASE,
        {
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
        },
        60_000, // sonar-pro runs live web search; 30s default is too tight
      );
      if (res.status !== 429 || attempt === MAX_ATTEMPTS - 1) break;
      await sleep(rateLimitWaitMs(res, attempt));
    }

    if (!res) return { data: null, error: "[perplexity] no attempt made" };
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
