// ─── Result type for all API wrappers ───────────────────────────────────────

export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// ─── Briefing sub-types ─────────────────────────────────────────────────────

export type TopStoryCategory =
  | "market"
  | "regulatory"
  | "adoption"
  | "macro"
  | "technical";

export interface TopStory {
  headline: string;
  source: string;
  url: string;
  summary: string; // 2-3 sentences, written for sophisticated investors
  sentiment: "bullish" | "bearish" | "neutral";
  // Thematic label so readers and listeners know what the story is about.
  // Optional for backward compatibility with briefings saved before this
  // field existed; new AI Brain outputs always populate it.
  category?: TopStoryCategory;
  tags: string[];
}

export interface MarketSnapshot {
  price_usd: number;
  change_24h_pct: number;
  change_7d_pct: number;
  market_cap_usd: number;
  volume_24h_usd: number;
  dominance_pct: number;
  ath_usd: number | null;
  ath_date: string | null;
}

export interface TechnicalSignals {
  rsi_14: number;
  sma_50: number;
  sma_200: number;
  support_level: number;
  resistance_level: number;
  signal_summary: string;
}

export interface AssetComparison {
  name: string; // "S&P 500" | "Gold" | "DXY"
  ticker: string;
  change_24h_pct: number | null;
  change_ytd_pct: number | null;
  change_1y_pct: number | null;
  btc_relative_24h_pct: number | null;
  btc_relative_ytd_pct: number | null;
  btc_relative_1y_pct: number | null;
}

export interface NetworkHealth {
  hashrate_eh_s: number;
  difficulty: number;
  block_height: number;
  mempool_tx_count: number;
  mempool_size_mb: number;
  fee_fast_sat_vb: number;
  fee_medium_sat_vb: number;
  fee_slow_sat_vb: number;
  halving_progress_pct: number;
  blocks_until_halving: number;
}

export interface DailyDiff {
  price_change: string;
  sentiment_shift: string;
  key_changes: string[];
}

export interface CountdownEvent {
  name: string;
  date: string; // ISO date or "TBD"
  days_away: number | null;
  description: string;
}

// ─── Executive-grade content sections ───────────────────────────────────────

export interface RegulatoryUpdate {
  headline: string;
  region: string;
  summary: string;
  impact: "positive" | "negative" | "neutral";
  source: string;
  url: string;
}

export interface AdoptionUpdate {
  headline: string;
  category: "corporate" | "institutional" | "merchant" | "country" | "infrastructure";
  summary: string;
  source: string;
  url: string;
}

export interface InstitutionalFlows {
  summary: string;
  notable_moves: string[];
}

export interface MacroContext {
  narrative: string;
  btc_correlation_note: string;
  key_macro_events: string[];
}

export interface SupplyDynamics {
  exchange_reserve_trend: string;
  long_term_holder_pct: number | null;
  supply_narrative: string;
}

export interface ExpertInsight {
  expert_name: string;
  role: string;
  twitter_handle?: string;
  photo_url?: string;
  quote_or_summary: string;
  source: string;
  date: string;
}

export interface NarrativeConsensus {
  score: number; // -100 to +100
  label: string;
  rationale: string;
}

// ─── ETF Flows (direct from SoSoValue API, no AI) ─────────────────────────

export interface ETFFlows {
  daily_net_flow_usd: number | null;   // Latest day's net flow
  mtd_net_flow_usd: number | null;     // Month-to-date cumulative
  total_net_assets_usd: number | null;  // Current total AUM
}

// ─── Perpetual Futures Funding Rate (OI-weighted) ─────────────────────────

export interface ExchangeFundingRate {
  exchange: "binance" | "bybit" | "okx";
  funding_rate: number;        // decimal e.g. 0.0001 = 0.01%
  open_interest_usd: number;
}

export interface FundingRate {
  weighted_rate: number;              // OI-weighted average across exchanges
  annualized_rate_pct: number;        // weighted_rate * 3 * 365 * 100
  total_open_interest_usd: number;
  exchanges: ExchangeFundingRate[];
}

// ─── Fear & Greed Index ──────────────────────────────────────────────────

export interface FearGreedIndex {
  value: number;   // 0-100
  label: string;   // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
}

// ─── 90-Day Rolling Correlation Matrix ───────────────────────────────────

export interface CorrelationMatrix {
  btc_gold_90d: number | null;
  btc_sp500_90d: number | null;
  data_points_gold: number;
  data_points_sp500: number;
  period_start: string;   // ISO date
  period_end: string;
}

// ─── Market Signals (trigger-based editorial callouts) ────────────────────
// Surfaced in the daily digest email + audio brief only when a threshold +
// cooldown check fires. Silent on quiet days. See processors/market-signals.ts.

export type MarketSignalType =
  | "correlation_regime"   // BTC-S&P or BTC-Gold 90d correlation crossed a regime threshold
  | "funding_extreme"      // OI-weighted perp funding in top decile or sign flipped after a streak
  | "sentiment_shift";     // Fear & Greed entered extreme zone or 7d delta >= 20 pts

export interface MarketSignal {
  type: MarketSignalType;
  severity: "high" | "medium";
  headline: string;  // <= 60 chars, peer-to-peer professional tone, no em dashes
  detail: string;    // 1-2 sentences, plain language, institutional lens
}

// ─── 3-Minute Contract hero (Pillar 1) ─────────────────────────────────────

export interface HeroThreeLines {
  move: string;   // max 140 chars: what BTC did in last 24h + most likely catalyst
  signal: string; // max 140 chars: what matters under the noise (interpretation, not headline)
  watch: string;  // max 140 chars: single next catalyst with date or timeframe
}

// ─── Silent prediction tracking (background task, day-60 scorecard) ────────

export interface LookingAheadPrediction {
  claim_text: string;
  direction: "up" | "down" | "flat";
  metric: string;      // e.g. "btc_price", "spx", "etf_flow_net", "rate_decision"
  target_date: string; // ISO date (YYYY-MM-DD)
}

// ─── Master Briefing type ───────────────────────────────────────────────────

export interface BriefingJSON {
  date: string;
  one_line?: string; // Single-sentence key insight for the day
  hero_three_lines?: HeroThreeLines; // Pillar 1: 3-Minute Contract hero
  read_time_seconds?: number;        // Pillar 1: word count at 200 wpm
  // Pillar 2: Morning Audio Brief. audio_url holds an internal path
  // (e.g. "/api/audio/2026-04-14") served by the token-gated audio route.
  // Null or undefined means audio generation failed or did not run.
  audio_url?: string | null;
  audio_duration_seconds?: number | null;
  // Full generated spoken-word script, saved alongside the audio so the
  // briefing can be audited (read the script from the DB, verify the data
  // is accurate) without downloading and transcribing the MP3.
  audio_script?: string | null;
  top_stories: TopStory[];
  market_snapshot: MarketSnapshot;
  technical_signals: TechnicalSignals;
  btc_vs_everything: AssetComparison[];
  network_health: NetworkHealth;
  daily_diff: DailyDiff;
  countdown_events: CountdownEvent[];
  looking_ahead: string;
  looking_ahead_predictions?: LookingAheadPrediction[]; // Silent data for day-60 scorecard
  regulatory: RegulatoryUpdate[];
  adoption: AdoptionUpdate[];
  narrative_consensus: NarrativeConsensus;
  macro_context: MacroContext;
  // Populated by enrichment (Perplexity), not AI brain
  institutional_flows: InstitutionalFlows;
  supply_dynamics: SupplyDynamics;
  expert_insights: ExpertInsight[];
  // Direct API data (no AI processing)
  etf_flows: ETFFlows | null;
  funding_rate?: FundingRate | null;
  fear_greed?: FearGreedIndex | null;
  correlation_matrix?: CorrelationMatrix | null;
  // Trigger-based editorial callouts. Empty/null on quiet days by design.
  // Populated by processors/market-signals.ts after enrichment, before audio brief.
  market_signals?: MarketSignal[] | null;
}

// ─── Triage types (two-pass news verification) ─────────────────────────────

export interface TriageItem {
  index: number;        // 0-based index in the original article array
  url: string;
  importance: number;   // 1-10 score
  reasoning: string;    // One-line explanation
}

export interface TriageOutput {
  ranked: TriageItem[];
}

export interface PerplexityCrossRefItem {
  headline: string;
  source: string;
  url: string;
  why_important: string;
}

export interface PerplexityCrossRefOutput {
  stories: PerplexityCrossRefItem[];
}

// ─── Collector output types ─────────────────────────────────────────────────

export interface RawArticle {
  title: string;
  url: string;
  source: string;
  published_at: string;
  description?: string;
  content?: string; // Full article text via Jina Reader
}

export interface NewsCollectorOutput {
  articles: RawArticle[];
}

export interface MarketCollectorOutput {
  price: {
    usd: number;
    change_24h_pct: number;
    change_7d_pct: number;
    market_cap_usd: number;
    volume_24h_usd: number;
  };
  ath_usd: number | null;
  ath_date: string | null;
  dominance_pct: number;
  technical: {
    rsi_14: number;
    sma_50: number;
    sma_200: number;
    support_level: number;
    resistance_level: number;
  };
  network: {
    hashrate_eh_s: number;
    difficulty: number;
    block_height: number;
    mempool_tx_count: number;
    mempool_size_mb: number;
    fee_fast_sat_vb: number;
    fee_medium_sat_vb: number;
    fee_slow_sat_vb: number;
  };
  comparisons: {
    sp500_change_24h_pct: number | null;
    sp500_change_ytd_pct: number | null;
    sp500_change_1y_pct: number | null;
    nasdaq_change_24h_pct: number | null;
    nasdaq_change_ytd_pct: number | null;
    nasdaq_change_1y_pct: number | null;
    gold_change_24h_pct: number | null;
    gold_change_ytd_pct: number | null;
    gold_change_1y_pct: number | null;
    dxy_change_24h_pct: number | null;
    dxy_change_ytd_pct: number | null;
    dxy_change_1y_pct: number | null;
    eth_change_24h_pct: number | null;
    eth_change_ytd_pct: number | null;
    eth_change_1y_pct: number | null;
    sol_change_24h_pct: number | null;
    sol_change_ytd_pct: number | null;
    sol_change_1y_pct: number | null;
  };
  btc_change_ytd_pct: number | null;
  btc_change_1y_pct: number | null;
  etf_flows: ETFFlows | null;
  funding_rate: FundingRate | null;
  fear_greed: FearGreedIndex | null;
  correlation_matrix: CorrelationMatrix | null;
}

// ─── Subscriber tier ────────────────────────────────────────────────────────

export type SubscriberTier = "free" | "pro";
export type SubscriberStatus = "active" | "unsubscribed" | "pending";

// ─── Database row types ─────────────────────────────────────────────────────

export interface DailyBriefingRow {
  date: string;
  content: BriefingJSON;
  created_at: string;
  updated_at: string;
}

export interface SubscriberRow {
  id: string;
  email: string;
  name: string | null;
  status: SubscriberStatus;
  tier: SubscriberTier;
  is_founding_member: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  tier_updated_at: string | null;
}

// ─── Weekly Recap types ────────────────────────────────────────────────────

export interface DaySummary {
  date: string;
  price_usd: number;
  change_24h_pct: number;
  consensus_label: string;
  consensus_score: number;
  one_line: string | null;
}

export interface WeeklyRecapData {
  week_start: string;
  week_end: string;
  days_available: number;
  price_start: number;
  price_end: number;
  price_change_pct: number;
  price_high: number;
  price_low: number;
  daily_summaries: DaySummary[];
  top_stories: Array<{
    headline: string;
    source: string;
    url: string;
    summary: string;
    sentiment: "bullish" | "bearish" | "neutral";
    date: string;
  }>;
  regulatory_highlights: Array<{
    headline: string;
    region: string;
    summary: string;
    impact: "positive" | "negative" | "neutral";
  }>;
  adoption_highlights: Array<{
    headline: string;
    category: string;
    summary: string;
  }>;
  btc_vs_everything: Array<{
    name: string;
    ticker: string;
    change_ytd_pct: number | null;
  }>;
  btc_7d_change_pct: number;
  market_cap_end: number;
  volume_avg: number;
  dominance_end: number;
}
