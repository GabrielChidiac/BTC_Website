import { z } from "zod";

// Zod schemas for Claude-generated JSON outputs. Used by callClaudeJSON to
// validate structural integrity at the pipeline boundary so drift fails loudly
// instead of silently corrupting Supabase rows or frontend renders.
//
// Keep these schemas in sync with the matching interfaces in src/lib/types.ts.
// Optional-in-types fields are optional() here; nullable-in-types are nullable().

// ─── Shared enums ──────────────────────────────────────────────────────────

const SentimentSchema = z.enum(["bullish", "bearish", "neutral"]);

// Restricted to themes that belong in the top_stories array. Adoption and
// regulatory items route to their own arrays and must never appear here,
// so zod rejects them at the pipeline boundary and triggers a retry.
const TopStoryCategorySchema = z.enum(["market", "macro", "technical"]);

// ─── Triage ────────────────────────────────────────────────────────────────

export const TriageItemSchema = z.object({
  index: z.number().int().min(0),
  url: z.string(),
  importance: z.number().int().min(1).max(10),
  reasoning: z.string(),
});

export const TriageOutputSchema = z.object({
  ranked: z.array(TriageItemSchema),
});

// ─── Perplexity cross-ref ─────────────────────────────────────────────────

export const PerplexityCrossRefItemSchema = z.object({
  headline: z.string(),
  source: z.string(),
  url: z.string(),
  why_important: z.string(),
});

export const PerplexityCrossRefOutputSchema = z.object({
  stories: z.array(PerplexityCrossRefItemSchema),
});

// ─── Audio brief script ────────────────────────────────────────────────────

export const AudioScriptSchema = z.object({
  script: z.string().min(100),
});

// ─── AI Brain sub-schemas (mirror types.ts) ───────────────────────────────

export const TopStorySchema = z.object({
  headline: z.string(),
  source: z.string(),
  url: z.string(),
  summary: z.string(),
  sentiment: SentimentSchema,
  category: TopStoryCategorySchema.optional(),
  tags: z.array(z.string()),
});

export const MarketSnapshotSchema = z.object({
  price_usd: z.number(),
  change_24h_pct: z.number(),
  change_7d_pct: z.number(),
  market_cap_usd: z.number(),
  volume_24h_usd: z.number(),
  dominance_pct: z.number(),
  ath_usd: z.number().nullable(),
  ath_date: z.string().nullable(),
});

export const TechnicalSignalsSchema = z.object({
  rsi_14: z.number(),
  sma_50: z.number(),
  sma_200: z.number(),
  support_level: z.number(),
  resistance_level: z.number(),
  signal_summary: z.string(),
});

export const AssetComparisonSchema = z.object({
  name: z.string(),
  ticker: z.string(),
  change_24h_pct: z.number().nullable(),
  change_ytd_pct: z.number().nullable(),
  change_1y_pct: z.number().nullable(),
  btc_relative_24h_pct: z.number().nullable(),
  btc_relative_ytd_pct: z.number().nullable(),
  btc_relative_1y_pct: z.number().nullable(),
});

export const NetworkHealthSchema = z.object({
  hashrate_eh_s: z.number(),
  difficulty: z.number(),
  block_height: z.number(),
  mempool_tx_count: z.number(),
  mempool_size_mb: z.number(),
  fee_fast_sat_vb: z.number(),
  fee_medium_sat_vb: z.number(),
  fee_slow_sat_vb: z.number(),
  halving_progress_pct: z.number(),
  blocks_until_halving: z.number(),
});

export const DailyDiffSchema = z.object({
  price_change: z.string(),
  sentiment_shift: z.string(),
  key_changes: z.array(z.string()),
});

export const CountdownEventSchema = z.object({
  name: z.string(),
  date: z.string(),
  days_away: z.number().nullable(),
  description: z.string(),
});

// Perplexity expert-insight output — validated at enrichment boundary so a
// malformed Perplexity response (missing fields, wrong shape) fails loudly
// instead of silently degrading to an empty homepage section.
export const ExpertInsightSchema = z.object({
  expert_name: z.string().min(1),
  role: z.string(),
  twitter_handle: z.string().optional().nullable(),
  photo_url: z.string().optional(),
  quote_or_summary: z.string().min(1),
  source: z.string(),
  date: z.string(),
});

export const ExpertInsightsArraySchema = z.array(ExpertInsightSchema).min(1).max(3);

export const RegulatoryUpdateSchema = z.object({
  headline: z.string(),
  region: z.string(),
  summary: z.string(),
  impact: z.enum(["positive", "negative", "neutral"]),
  source: z.string(),
  url: z.string(),
});

export const AdoptionUpdateSchema = z.object({
  headline: z.string(),
  category: z.enum([
    "corporate",
    "institutional",
    "merchant",
    "country",
    "infrastructure",
  ]),
  summary: z.string(),
  source: z.string(),
  url: z.string(),
});

export const NarrativeConsensusSchema = z.object({
  score: z.number().min(-100).max(100),
  label: z.string(),
  rationale: z.string(),
});

export const MacroContextSchema = z.object({
  narrative: z.string(),
  btc_correlation_note: z.string(),
  key_macro_events: z.array(z.string()),
});

export const HeroThreeLinesSchema = z.object({
  move: z.string(),
  signal: z.string(),
  watch: z.string(),
});

export const LookingAheadPredictionSchema = z.object({
  claim_text: z.string(),
  direction: z.enum(["up", "down", "flat"]),
  metric: z.string(),
  target_date: z.string(),
});

// ─── AI Brain output (full briefing minus enrichment fields) ──────────────
//
// Matches the AiBrainOutput type in processors/ai-brain.ts, which is
// `Omit<BriefingJSON, "looking_ahead" | "institutional_flows" | "supply_dynamics"
//       | "expert_insights" | "etf_flows"> & { one_line?: string }`.
//
// passthrough() preserves any extra fields Claude may emit (forward-compat)
// instead of stripping them silently.

export const AiBrainOutputSchema = z
  .object({
    date: z.string(),
    one_line: z.string().optional(),
    hero_three_lines: HeroThreeLinesSchema.optional(),
    read_time_seconds: z.number().optional(),
    top_stories: z.array(TopStorySchema),
    market_snapshot: MarketSnapshotSchema,
    technical_signals: TechnicalSignalsSchema,
    btc_vs_everything: z.array(AssetComparisonSchema),
    network_health: NetworkHealthSchema,
    daily_diff: DailyDiffSchema,
    countdown_events: z.array(CountdownEventSchema),
    looking_ahead_predictions: z.array(LookingAheadPredictionSchema).optional(),
    regulatory: z.array(RegulatoryUpdateSchema),
    adoption: z.array(AdoptionUpdateSchema),
    narrative_consensus: NarrativeConsensusSchema,
    macro_context: MacroContextSchema,
    // These may or may not be emitted by Claude depending on prompt variant;
    // real values come from the market collector and are merged downstream.
    funding_rate: z.unknown().optional(),
    fear_greed: z.unknown().optional(),
    correlation_matrix: z.unknown().optional(),
  })
  .passthrough();

// ─── Day classification (precursor to AI brain) ───────────────────────────

export const DayClassificationSchema = z.object({
  label: z.enum(["thesis_shift", "risk_change", "mostly_noise", "mixed"]),
  confidence: z.number().min(0).max(1),
  depth_weight: z.enum(["heavy", "standard", "light"]),
  reasoning: z.string(),
  day_tone_line: z.string(),
});
