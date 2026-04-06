// ─── Navigation ─────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { href: "/", label: "Briefing" },
  { href: "/chat", label: "Ask AI" },
  { href: "/archive", label: "Archive" },
] as const;

export const SECTION_LINKS = [
  { href: "/#insight", label: "Insight" },
  { href: "/#market", label: "Market" },
  { href: "/#news", label: "News" },
  { href: "/#stories", label: "Stories" },
  { href: "/#deep-dive", label: "Deep Dive" },
  { href: "/#outlook", label: "Looking Ahead" },
] as const;

/**
 * Check if a nav link is active based on the current pathname.
 * Exact match for "/" to avoid false positives.
 */
export function isActiveLink(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// ─── Pro Features ───────────────────────────────────────────────────────────

export interface ProFeature {
  label: string;
  desc: string;
  freeIncluded: boolean;
}

export const FEATURES: ProFeature[] = [
  { label: "Daily market overview", desc: "Price, volume, dominance, sentiment", freeIncluded: true },
  { label: "Top stories with sentiment", desc: "AI-curated news through an institutional lens", freeIncluded: true },
  { label: "BTC vs Everything comparisons", desc: "SPX, Gold, DXY, ETH, SOL", freeIncluded: true },
  { label: "Weekly recap email", desc: "Sunday summary of the week", freeIncluded: true },
  { label: "Regulatory & adoption signals", desc: "Policy shifts, corporate BTC moves", freeIncluded: false },
  { label: "Daily email briefing", desc: "Full briefing delivered to your inbox", freeIncluded: false },
  { label: "Institutional flows & ETF data", desc: "ETF net flows, notable moves", freeIncluded: false },
  { label: "Technical signals", desc: "RSI, SMAs, support & resistance", freeIncluded: false },
  { label: "Network health & halving", desc: "Hashrate, fees, halving countdown", freeIncluded: false },
  { label: "Expert insights", desc: "Lyn Alden, Dylan LeClair, and more", freeIncluded: false },
  { label: "Forward outlook", desc: "Macro, regulatory, technical analysis", freeIncluded: false },
  { label: "AI Chat assistant", desc: "Ask questions about today's data", freeIncluded: false },
  { label: "PDF downloads", desc: "1-page daily summary", freeIncluded: false },
  { label: "Full archive access", desc: "Access all historical briefings", freeIncluded: false },
];

// ─── Email ──────────────────────────────────────────────────────────────────

export const EMAIL_BATCH_SIZE = 100; // Resend batch limit per call
export const FROM_ADDRESS = "BTC Today <hello@btctoday.co>";

// ─── Validation ─────────────────────────────────────────────────────────────

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

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

// ─── Event Filtering ────────────────────────────────────────────────────────

export const BLOCKED_EVENT_KEYWORDS = /conference|summit|expo|convention|meetup|hackathon/i;

// ─── Halving ────────────────────────────────────────────────────────────────

export const HALVING_INTERVAL = 210_000;

// ─── Pipeline ───────────────────────────────────────────────────────────────

export const ARTICLE_MAX_AGE_HOURS = 24;
