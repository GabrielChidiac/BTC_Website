# Phase 2 — Agent B: AI + Comparison Wrappers

## Mission
Create 3 API wrapper files in `src/trigger/lib/`. These are plain async functions (no Trigger.dev imports) that handle AI calls and traditional market comparisons, returning `Result<T>`.

## Shared Rules
- Every function returns `Result<T>` (import from `@/lib/types`)
- Import constants from `@/lib/constants`
- Use native `fetch` for HTTP calls — no axios
- Wrap all external calls in try/catch → return `{ data: null, error: message }` on failure
- No Trigger.dev imports — these are utility functions called by processor/collector tasks later

```typescript
import type { Result } from "@/lib/types";
// on success: return { data: ..., error: null };
// on failure: return { data: null, error: `[wrapper-name] ${e.message}` };
```

---

## File 1: `src/trigger/lib/anthropic.ts`

**Purpose:** Send prompts to Claude Sonnet for briefing generation. Fallback to Kie.ai on failure.

**Imports:**
- `Result` from `@/lib/types`
- `Anthropic` from `@anthropic-ai/sdk`

**Auth:**
- Primary: `ANTHROPIC_API_KEY` env var (used by SDK)
- Fallback: `KIE_API_KEY` env var (Kie.ai, OpenAI-compatible endpoint)

**Function:**
```typescript
export async function callClaude(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<Result<string>>
```

**Logic:**
1. **Primary — Anthropic SDK:**
   - Create `new Anthropic()` (reads `ANTHROPIC_API_KEY` from env automatically)
   - Call `client.messages.create({ model: "claude-sonnet-4-20250514", max_tokens: params.maxTokens ?? 8192, system: params.system, messages: [{ role: "user", content: params.prompt }] })`
   - Extract text from `response.content[0].text`
   - Return `{ data: text, error: null }`

2. **On 429 or 5xx error — Fallback to Kie.ai:**
   - `POST https://api.kie.ai/v1/chat/completions` with OpenAI-compatible body
   - Headers: `Authorization: Bearer ${KIE_API_KEY}`
   - Body: `{ model: "claude-sonnet-4-20250514", messages: [{ role: "system", content: system }, { role: "user", content: prompt }], max_tokens }`
   - Extract `choices[0].message.content`

3. **If both fail:** Return `{ data: null, error: message }`

**Additional helper:**
```typescript
export async function callClaudeJSON<T>(params: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<Result<T>>
```
- Calls `callClaude` then `JSON.parse` the response
- **On JSON parse failure:** Retry once with a "fix your JSON" follow-up prompt:
  - Send original response + `"Your previous response was not valid JSON. Please return ONLY valid JSON, no markdown fences or extra text."`
  - Parse again. If still fails, return error.

---

## File 2: `src/trigger/lib/perplexity.ts`

**Purpose:** Query Perplexity's `sonar-pro` model for forward-looking analysis (enrichment).

**Imports:**
- `PERPLEXITY_BASE` from `@/lib/constants`
- `Result` from `@/lib/types`

**Auth:** `PERPLEXITY_API_KEY` env var, passed as `Authorization: Bearer` header

**Function:**
```typescript
export async function queryPerplexity(params: {
  system: string;
  prompt: string;
}): Promise<Result<string>>
```

**Logic:**
1. `POST ${PERPLEXITY_BASE}` (which is `https://api.perplexity.ai/chat/completions`)
2. Headers: `Authorization: Bearer ${PERPLEXITY_API_KEY}`, `Content-Type: application/json`
3. Body:
   ```json
   {
     "model": "sonar-pro",
     "messages": [
       { "role": "system", "content": params.system },
       { "role": "user", "content": params.prompt }
     ]
   }
   ```
4. Extract `choices[0].message.content` from response
5. Return as `Result<string>`

---

## File 3: `src/trigger/lib/comparison.ts`

**Purpose:** Fetch S&P 500 and DXY data for "BTC vs Everything" comparison.

**Imports:**
- `ALPHA_VANTAGE_BASE` from `@/lib/constants`
- `Result` from `@/lib/types`
- `yahooFinance` from `yahoo-finance2`

**Auth:** `ALPHA_VANTAGE_API_KEY` env var (query param `apikey`)

**Functions:**
```typescript
export async function fetchSP500(): Promise<Result<{ change_24h_pct: number }>>
export async function fetchDXY(): Promise<Result<{ change_24h_pct: number }>>
```

**fetchSP500 logic:**
1. Use `yahoo-finance2`: `yahooFinance.quote("^GSPC")`
2. Extract `regularMarketChangePercent` for 24h change
3. **On failure:** Return `{ data: null, error }` — this is non-fatal (plan says "fallback: omit if API breaks")

**fetchDXY logic:**
1. `GET ${ALPHA_VANTAGE_BASE}?function=GLOBAL_QUOTE&symbol=DX-Y.NYB&apikey=${key}`
2. Parse `Global Quote` → `10. change percent` (strip `%` sign, parse as number)
3. **On failure:** Return `{ data: null, error }` — non-fatal

**Note:** Gold price comes from CoinGecko (handled by Agent A in `coingecko.ts`), not this file.
