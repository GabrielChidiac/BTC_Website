// ─── RSS Feed URLs ──────────────────────────────────────────────────────────

export const RSS_FEEDS = [
  // ── Tier 1: Core Bitcoin/crypto outlets ───────────────────────────────────
  { name: "CoinDesk", url: "https://www.coindesk.com/arc/outboundfeeds/rss/" },
  { name: "Bitcoin Magazine", url: "https://bitcoinmagazine.com/feed" },
  { name: "The Block", url: "https://www.theblock.co/rss.xml" },
  { name: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { name: "Decrypt", url: "https://decrypt.co/feed" },
  // ── Tier 2: Institutional / macro coverage ────────────────────────────────
  { name: "Blockworks", url: "https://blockworks.co/feed/" },
  { name: "CNBC Crypto", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=33002079" },
  // ── Tier 3: Expert Substack newsletters ───────────────────────────────────
  { name: "Lyn Alden", url: "https://www.lynalden.com/feed/" },
  { name: "Dylan LeClair", url: "https://dylanleclair.substack.com/feed" },
  { name: "Luke Gromen", url: "https://fftt-llc.substack.com/feed" },
  { name: "Jeff Park", url: "https://jeffpark.substack.com/feed" },
] as const;

// ─── SearchAPI ─────────────────────────────────────────────────────────────

export const SEARCHAPI_BASE = "https://www.searchapi.io/api/v1/search";
export const SEARCH_QUERIES = [
  "Bitcoin BTC",
] as const;

// ─── API Base URLs ──────────────────────────────────────────────────────────

export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
export const MEMPOOL_BASE = "https://mempool.space/api";
export const ALTERNATIVE_ME_FNG = "https://api.alternative.me/fng/";
export const PERPLEXITY_BASE = "https://api.perplexity.ai/chat/completions";
export const SOSOVALUE_ETF_HISTORY = "https://api.sosovalue.xyz/openapi/v2/etf/historicalInflowChart";

// ─── Halving ────────────────────────────────────────────────────────────────

export const HALVING_INTERVAL = 210_000;

// ─── Pipeline ───────────────────────────────────────────────────────────────

export const ARTICLE_MAX_AGE_HOURS = 24;
