# agents/CLAUDE.md

Scoped guidance for sub-agent specifications. See [/CLAUDE.md](/CLAUDE.md) for global rules.

## Scope
This directory holds **specifications** for the three pipeline sub-agents (Scraper, Analyst, Synthesizer). These are design documents that describe each agent's contract, integration point, and required functions. Actual Trigger.dev task implementations live under [/src/trigger/](../src/trigger/).

## Architectural decision (locked)
The pipeline keeps its existing shape but **adds the Analyst as a new pre-step between collection and the AI Brain**. The AI Brain is renamed Synthesizer in role but stays as a single Claude call to preserve coherence. Cost increase: ~1.5x. Latency increase: +30-60s. Coherence risk: low because Analyst output is structured (AnalysisBlock) and consumed by the Synthesizer, not freely interpolated.

Rejected alternatives: full split into Analyst + Synthesizer (2-3x cost, real coherence work); full sub-agent rebuild (3-4 weeks).

## Files
- [scraper-agent.md](scraper-agent.md) — comprehensive data collection across news, market, on-chain, social. Formalizes the existing collectors + Jina + Perplexity cross-ref + (optional) social/on-chain extensions.
- [analyst-agent.md](analyst-agent.md) — **NEW**. Produces a structured AnalysisBlock that the Synthesizer consumes. Tightly-tuned analytical Claude call with EXPERT_CONTEXT, market comparative baselines, regime classification.
- [synthesizer-agent.md](synthesizer-agent.md) — formalizes today's AI Brain + enrichment merge step. Generates the user-facing BriefingJSON in voice; consumes scraper + analyst outputs.

## Pipeline integration
```
[1] Scraper Agent (collectors + cross-ref + Jina)
       ↓
[2] Analyst Agent — produces AnalysisBlock
       ↓
[3] Synthesizer Agent — produces BriefingJSON
       ↓
[4] Enrichment (Perplexity ×4, parallel, unchanged)
       ↓
[5] Validators (12, unchanged) → Save → Distribute
```

## When editing these specs
- Update the corresponding implementation under [src/trigger/](../src/trigger/) in the same change. Specs and code drift fast otherwise.
- Document required functions referencing existing wrappers in [../src/trigger/lib/](../src/trigger/lib/) — never invent new wrappers without checking what's there.
- Each spec must include: purpose, pipeline position, input contract, output contract, system prompt outline, required functions (with file paths), failure modes, implementation sketch.
