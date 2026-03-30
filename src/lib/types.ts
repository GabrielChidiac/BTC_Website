// ─── Result type for all API wrappers ───────────────────────────────────────

export type Result<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// ─── Chat types ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ─── Briefing sub-types ─────────────────────────────────────────────────────

export interface TopStory {
  headline: string;
  source: string;
  url: string;
  summary: string; // 2-3 sentences, written for sophisticated investors
  sentiment: "bullish" | "bearish" | "neutral";
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
  etf_net_flow_usd: number | null;
  etf_total_aum_usd: number | null;
  etf_flow_trend: string;
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

// ─── Fear & Greed (direct from Alternative.me API, no AI) ──────────────────

export interface FearGreedIndex {
  value: number;  // 0-100
  label: string;  // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
}

// ─── Master Briefing type ───────────────────────────────────────────────────

export interface BriefingJSON {
  date: string;
  one_line?: string; // Single-sentence key insight for the day
  top_stories: TopStory[];
  market_snapshot: MarketSnapshot;
  technical_signals: TechnicalSignals;
  btc_vs_everything: AssetComparison[];
  network_health: NetworkHealth;
  daily_diff: DailyDiff;
  countdown_events: CountdownEvent[];
  looking_ahead: string;
  regulatory: RegulatoryUpdate[];
  adoption: AdoptionUpdate[];
  narrative_consensus: NarrativeConsensus;
  macro_context: MacroContext;
  // Populated by enrichment (Perplexity), not AI brain
  institutional_flows: InstitutionalFlows;
  supply_dynamics: SupplyDynamics;
  expert_insights: ExpertInsight[];
  // Direct API data (no AI processing)
  fear_greed: FearGreedIndex | null;
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
  fear_greed: FearGreedIndex | null;
}

// ─── Subscriber tier ────────────────────────────────────────────────────────

export type SubscriberTier = "free" | "pro";

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
  status: "active" | "unsubscribed";
  tier: SubscriberTier;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
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
  fear_greed_value: number | null;
  fear_greed_label: string | null;
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
  fear_greed_start: { value: number; label: string } | null;
  fear_greed_end: { value: number; label: string } | null;
  market_cap_end: number;
  volume_avg: number;
  dominance_end: number;
}
