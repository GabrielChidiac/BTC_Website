# Phase 4 — Agent B: Enrichment Processor Task

## Mission
Create `src/trigger/processors/enrichment.ts` — a Trigger.dev task that takes the top 3 headlines from the AI brain output and sends them to Perplexity sonar-pro to generate a forward-looking analysis paragraph (`looking_ahead`).

## Shared Rules
- Import `task`, `logger` from `@trigger.dev/sdk/v3`
- Use `Result<T>` pattern (import from `@/lib/types`)
- Use `queryPerplexity` from `@/trigger/lib/perplexity` for the API call
- This task is **non-fatal** — the orchestrator catches errors and uses a fallback string

---

## File: `src/trigger/processors/enrichment.ts`

**Purpose:** Generate a forward-looking analysis paragraph using Perplexity sonar-pro, grounded in today's top stories.

**Imports:**
- `task`, `logger` from `@trigger.dev/sdk/v3`
- `queryPerplexity` from `@/trigger/lib/perplexity`
- `TopStory` from `@/lib/types`

**Task ID:** `"enrichment"`

**Payload:**
```typescript
{
  top_stories: TopStory[];  // Already sliced to top 3 by the orchestrator
}
```

**Return type:**
```typescript
{
  looking_ahead: string;  // 2-3 paragraph forward-looking analysis
}
```

**Logic:**

### Step 1: Build the Perplexity prompt
1. **System prompt:** Instruct Perplexity to act as a forward-looking Bitcoin market analyst. Key instructions:
   - Use web search capabilities to find the latest developments
   - Focus on what these stories mean for the next 24-72 hours
   - Consider regulatory implications, market sentiment shifts, and technical catalysts
   - Write 2-3 concise paragraphs
   - Be factual and measured — avoid hype or fear-mongering
   - Do NOT use markdown formatting — return plain text only

2. **User prompt:** Include the top 3 stories:
   - For each story: headline, source, summary
   - Ask: "Based on these top Bitcoin stories today, what should readers watch for in the next 24-72 hours? Consider market implications, regulatory developments, and any upcoming catalysts."

### Step 2: Call Perplexity
1. Use `queryPerplexity({ system, prompt })`
2. If the call returns an error, log it and **throw** (the orchestrator catches this — enrichment is non-fatal)

### Step 3: Return
1. Return `{ looking_ahead: result.data }` — the raw text from Perplexity

---

## Edge Cases
- If `top_stories` is empty (no news today), use a generic prompt: "What are the key things Bitcoin investors should watch for in the next 24-72 hours?"
- If Perplexity returns empty text, throw an error so the orchestrator uses the fallback string

---

## Key Constraints
- This task **may throw** — it's the only task where throwing is acceptable because the orchestrator wraps it in a try/catch
- Keep the prompt concise — Perplexity has its own context limits
- Do NOT ask Perplexity for JSON — just plain text paragraphs
- The output goes directly into `BriefingJSON.looking_ahead`
