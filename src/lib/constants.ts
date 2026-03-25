// ─── RSS Feed URLs ──────────────────────────────────────────────────────────

export const RSS_FEEDS = [
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
] as const;

// ─── API Base URLs ──────────────────────────────────────────────────────────

export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
export const MEMPOOL_BASE = "https://mempool.space/api";
export const ALTERNATIVE_ME_FNG = "https://api.alternative.me/fng/";
export const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search";
export const PERPLEXITY_BASE = "https://api.perplexity.ai/chat/completions";
export const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

// ─── Search Queries (institutional focus) ───────────────────────────────────

export const SEARCH_QUERIES = [
  "Bitcoin ETF institutional flows",
  "Bitcoin corporate treasury adoption",
  "Bitcoin macro monetary policy regulation",
] as const;

// ─── Halving ────────────────────────────────────────────────────────────────

export const HALVING_INTERVAL = 210_000;

// ─── Pipeline ───────────────────────────────────────────────────────────────

export const ARTICLE_MAX_AGE_HOURS = 24;
