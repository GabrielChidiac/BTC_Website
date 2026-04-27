// ─── Navigation ─────────────────────────────────────────────────────────────

export const NAV_LINKS = [
  { href: "/", label: "Briefing" },
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

export const TAB_BRIEFING = "briefing";
export const TAB_DEEP_DIVE = "deep-dive-tab";

export const SECTION_TAB_MAP: Record<string, string> = {
  market: TAB_BRIEFING,
  news: TAB_BRIEFING,
  stories: TAB_BRIEFING,
  signals: TAB_DEEP_DIVE,
  "deep-dive": TAB_DEEP_DIVE,
  outlook: TAB_DEEP_DIVE,
};

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
  { label: "Regulatory signals", desc: "Policy shifts and enforcement moves", freeIncluded: false },
  { label: "Daily email briefing", desc: "Full briefing delivered to your inbox", freeIncluded: false },
  { label: "Institutional flows & ETF data", desc: "ETF net flows, notable moves", freeIncluded: false },
  { label: "Technical signals", desc: "RSI, SMAs, support & resistance", freeIncluded: false },
  { label: "Network health & halving", desc: "Hashrate, fees, halving countdown", freeIncluded: false },
  { label: "Expert insights", desc: "Lyn Alden, Dylan LeClair, and more", freeIncluded: false },
  { label: "Forward outlook", desc: "Macro, regulatory, technical analysis", freeIncluded: false },
  { label: "Funding rate analysis", desc: "OI-weighted perp funding across top exchanges", freeIncluded: false },
  { label: "Fear & Greed Index", desc: "Daily crypto market sentiment gauge", freeIncluded: false },
  { label: "Correlation matrix", desc: "90-day BTC vs Gold and S&P 500", freeIncluded: false },
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
export const PERPLEXITY_BASE = "https://api.perplexity.ai/chat/completions";
export const SOSOVALUE_ETF_HISTORY = "https://api.sosovalue.xyz/openapi/v2/etf/historicalInflowChart";
export const ALTERNATIVE_ME_FNG = "https://api.alternative.me/fng/?limit=1";

// ─── Event Filtering ────────────────────────────────────────────────────────

export const BLOCKED_EVENT_KEYWORDS = /conference|summit|expo|convention|meetup|hackathon/i;

// ─── Halving ────────────────────────────────────────────────────────────────

export const HALVING_INTERVAL = 210_000;

// ─── Founding Members ──────────────────────────────────────────────────────

export const FOUNDING_MEMBER_LIMIT = 100;

// ─── Pipeline ───────────────────────────────────────────────────────────────

export const ARTICLE_MAX_AGE_HOURS = 24;

// ─── Lightning tips ─────────────────────────────────────────────────────────

/**
 * Preset tip amounts in satoshis. 21k is on-brand for Bitcoin (max supply
 * 21M); the smaller and larger options bracket it for choice without
 * presenting a wall of buttons. Custom amount is always available via input.
 */
export const TIP_PRESETS_SATS = [1_000, 5_000, 21_000, 100_000] as const;
export const TIP_MIN_SATS = 21;
export const TIP_MAX_SATS = 1_000_000;
export const TIP_MESSAGE_MAX_LEN = 200;

// ─── Card tips (Stripe one-time Checkout) ───────────────────────────────────

/**
 * Preset tip amounts in USD cents. $21 keeps the Bitcoin "21M cap" anchor;
 * $10 floor keeps Stripe's per-transaction fee under ~6% of the tip.
 * Custom amount available via input. UI floor is $10; DB floor is $1
 * (TIP_MIN_CENTS) so a manual cents value below preset still validates.
 */
export const TIP_PRESETS_CENTS = [1_000, 2_100, 5_000, 10_000] as const;
export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 100_000;

// ─── On-chain BTC tip ───────────────────────────────────────────────────────

/**
 * Mainnet receive address for fire-and-forget on-chain tips. We do not
 * track on-chain payments per row -- the address is advertised on /tip and
 * tippers send directly. Set at deploy time in Vercel env; rotate manually
 * by updating the env var.
 */
export const BTC_TIP_ADDRESS = process.env.NEXT_PUBLIC_BTC_TIP_ADDRESS ?? "";
