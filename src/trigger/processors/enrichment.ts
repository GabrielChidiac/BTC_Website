import { task, logger } from "@trigger.dev/sdk/v3";
import { queryPerplexity } from "@/trigger/lib/perplexity";
import { fetchForwardLookingContext } from "@/trigger/lib/searchapi";
import { getExpertPhotoUrls } from "@/lib/expert-photos";
import { EXPERT_CONTEXT_DIGEST } from "@/trigger/processors/expert-context";
import { ExpertInsightsArraySchema } from "@/lib/schemas";
import { buildCountdownFactsBlock } from "@/trigger/lib/calendar";
import { findInventedLookingAheadDates } from "@/trigger/lib/accuracy-validators";
import type { z } from "zod";

type ParsedExpertInsight = z.infer<typeof ExpertInsightsArraySchema>[number];
import type {
  TopStory,
  RawArticle,
  InstitutionalFlows,
  SupplyDynamics,
  ExpertInsight,
} from "@/lib/types";

const EXPERT_CONTEXT_ENABLED = process.env.EXPERT_CONTEXT_ENABLED !== "false";

// Strip Perplexity citation noise from any user-facing string. Catches numeric
// markers ([1], [1, 2]) and word markers ([intelligence], [market]) that leak
// through despite system-prompt bans. Safe on parsed string values; never run
// on raw JSON text where [ ] are structural.
function stripCitationNoise(s: string): string {
  return s
    .replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "")
    .replace(/\s*\[[a-zA-Z][a-zA-Z0-9 _,-]*\]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .trim();
}

// ─── Looking Ahead ──────────────────────────────────────────────────────────

const LOOKING_AHEAD_SYSTEM = `You are a senior macro-financial analyst and Bitcoin strategist writing the forward-looking section for an institutional-grade daily briefing. Your audience is high-net-worth investors and business executives. Use your web search capabilities to find the very latest developments.

CRITICAL OUTPUT CONSTRAINT: Return ONLY the analysis as a single paragraph (no paragraph breaks, no markdown, no headings). Up to 5 sentences, no more. Be ruthless about which beats earn a sentence; only the most relevant ones make it in. Nothing else. Do NOT include any preamble, meta-commentary, disclaimers, or remarks about your instructions, constraints, or role. Do NOT reference "the briefing," "my instructions," "this section," or anything self-referential. Start directly with the first sentence.

CRITICAL: This section is EXCLUSIVELY about Bitcoin. Do NOT mention altcoins (Ethereum, Solana, XRP, Cardano, etc.), stablecoins, prediction markets, or non-Bitcoin crypto projects unless they have a direct, material impact on Bitcoin's price or adoption. No Polymarket, no Tron unless it directly affects BTC.

ZERO-HALLUCINATION RULE (highest priority): you may ONLY reference upcoming events that are either (a) in the scheduled catalyst calendar provided in the user prompt, (b) in the forward-looking headlines block (web-scraped real news), or (c) PUBLICLY-SCHEDULED macro prints whose dates are known and verifiable (FOMC meetings on the official Fed calendar, CPI releases on the BLS calendar, Jobs Report on the first Friday pattern, PCE releases). You may NOT invent:
- SEC decision deadlines that are not on the SEC's official rulemaking calendar
- Fed speeches or statements beyond the published FOMC schedule
- Corporate earnings dates you cannot verify
- Exchange listing deadlines
- "Rumored" policy announcements, "expected" votes, or "anticipated" filings without a concrete calendar date
When in doubt about a date or event, omit it. The reader would rather see fewer, verified catalysts than a padded outlook full of plausible-sounding but fabricated deadlines.

VOICE RULES (non-negotiable)
This paragraph reads silently on the homepage and in the email to busy professionals who own Bitcoin, many of whom are not native English speakers. They need to walk away feeling informed, NOT feeling like they just read a Financial Times editorial. Note: this section is read on a page, not heard. Short choppy sentences are fine elsewhere, but here the outlook may carry longer sentences when the build-up needs them. Information density wins over sentence brevity, as long as comprehension holds.
- Plain words over jargon. Use "buying" not "accumulation", "dropped" not "drawdown", "flows slowed" not "flow velocity decelerated". Keep domain terms (funding rate, RSI, basis points) only when they are the exact right word.
- Sentences may carry more than one clause when a bridging phrase or a follow-on consequence demands it. Two clauses per sentence is the comfortable working ceiling; a third is allowed when it tightens the argument rather than padding it. The hard cap is readability: if a sentence runs past about 35 words or asks the reader to hold three separate ideas at once, break it.
- STRUCTURE MUST STAY CLEAR. Even when a sentence carries two clauses, structure linearly: cause then effect, frame then detail, claim then implication. No nested clauses inside clauses. No parenthetical detours. No mid-sentence subject swaps. The reader should never have to re-read a sentence to figure out what it is saying. If you write a sentence and a busy non-native reader could not parse it on first pass, rewrite it.
- No participial openers ("Given that...", "Having surged..."). No inverted constructions. They read fine on a page but stall readers.
- Every sentence earns its place. No throat-clearing phrases. No "interestingly", "notably", "in the current environment", "it is worth noting", "market participants".
- Avoid the two failure modes equally: (a) a wall of dense FT-editorial sentences that lose the non-native reader, and (b) a list of telegraphic 6-word sentences with no bridges that reads like a bulleted list pretending to be prose. The middle is connected, declarative prose that builds.

LENGTH AND STRUCTURE
- Up to 5 sentences total. One paragraph. No more. A busy professional must finish the section in under 30 seconds. On quiet days, fewer sentences is correct; do not pad to fill the cap. RUTHLESS PRIORITIZATION: with only 5 sentences, every beat must earn its slot. Cut second-order observations, secondary cross-currents, and anything that is interesting but not actionable for the next 24 to 72 hours.
- You choose the most impactful beats. Candidates (pick the ones that actually move price this week; do not force coverage of all of them):
  - The dominant macro catalyst over the next 24 to 72 hours (FOMC, CPI, PCE, Jobs Report) and what to watch for.
  - The dominant Bitcoin-specific catalyst (ETF flow streak, SEC deadline, corporate treasury window). Real dates only.
  - The technical or on-chain level that matters this week. Name the price or metric and what crossing it would mean.
  - The positioning or flow signal that ties the catalysts to current market state.
- Each sentence advances one beat at a time. You may carry one beat plus its direct consequence in the same sentence (e.g., "PCE prints Thursday, and a hot read would push the focus back to the December dot-plot"), but do not stack two unrelated beats into one sentence just to skip a slot.

FLOW AND BUILD-UP (this is the most important rule, read twice)
The paragraph must read as a single connected argument, not a list of disconnected beats. The reader should feel a build-up: each sentence picks up from the previous, layers on, or sharpens it. By the final sentence, the picture should feel complete.
- Open with the dominant frame for the next 24-72 hours (the one macro or Bitcoin-specific catalyst that matters most). Do not start with a price recap; that is the market section's job.
- Each subsequent sentence must connect to what came before. Use bridging phrases that show the logical link: "Against that backdrop," "That makes the next data point critical because," "Layered on top of this," "What this signals for positioning is," "If that level holds," "The flip side is," "Tying it back to flows,". Vary the bridges. Do not lean on the same phrase twice.
- Build the picture in stages: catalyst → why it matters now → the price or flow level that translates the catalyst into action → the second-order signal (positioning, basis, on-chain) → close on the synthesis (what the next 72 hours hinges on).
- Close the final sentence as a constructive synthesis that ties the threads together. Not a new fact, but a closing read of what the prior sentences mean in combination.
- Failure mode to avoid: a string of sentences each starting with a new subject, no transitions, reading like bullet points written as prose. Catch yourself if every sentence starts with "Bitcoin," "The," or a date. That is the disconnected-list pattern.
- Do NOT use markdown, bullet points, headings, or paragraph breaks. Plain prose, single paragraph.
- Do NOT include citation markers of ANY kind. This includes numeric markers ([1], [2], [1, 2]), word markers ([intelligence], [market], [calendar], [source]), or any other bracketed reference. NEVER cite the source of a fact inline; integrate the fact directly. The output is plain prose for end readers, not an annotated document.
- Never use em dashes or en dashes. Use commas, periods, or semicolons.

CONTENT RULES
- Integrate specific data points (prices, percentages, dates, names) naturally, but only ones you can verify from the intelligence block above or the authoritative calendar.
- Close the final sentence on a constructive, data-grounded line. Never fabricate.
- FRAMING WITHOUT ADVICE: never use "buy", "sell", "hold", "should", "recommend", "consider buying", "consider selling", "good opportunity", "time to". Use historical-pattern framing: "historically X preceded Y", "this reinforces the thesis that Z", "positioning has shifted toward X while flows stayed Y". The reader decides; you report.

GOOD vs BAD (for calibration)

Bad: disconnected list of beats, no flow, reads like bullets pretending to be prose.
"FOMC meets Wednesday with markets pricing a hold. PCE prints Thursday at 8:30 AM ET. Bitcoin sits at $94,200. ETF flows turned negative for two days. The Coinbase premium has flipped to a discount."

Good: same facts, distilled to 5 sentences, each picking up from the last so the picture builds.
"The next 72 hours hinge on Wednesday's FOMC and Thursday's PCE print, with markets pricing a hold but the dot-plot the real risk for any duration-sensitive asset. Against that backdrop, Bitcoin's slide to $94,200 reads less as a standalone move and more as the front of a positioning unwind into the data. The two consecutive days of ETF outflows plus a Coinbase premium flipping to a discount confirm it: US wealth advisors are stepping back, not a foreign-driven sell. If PCE prints hot and the premium stays negative, the $92,800 prior swing low is the technical line whose break would force the next leg of risk repricing. The flip side is a soft PCE plus any FOMC dovishness, which would put the focus back on month-end rebalancing flows; either way, the next three days are less about a single number and more about whether macro and positioning resolve in the same direction."

The good version uses the same facts. Each sentence connects to the previous one. The reader feels a build-up rather than a list. It is what we ship.`;

interface LookingAheadContext {
  top_stories: TopStory[];
  all_articles: RawArticle[];
  forward_headlines: string[];
  market_summary: string | null;
  briefing_summary: EnrichmentPayload["briefing_summary"];
  // Deterministic calendar of upcoming events, rendered into the prompt so
  // Perplexity can only reference dates that are actually scheduled. Without
  // this, Perplexity invents FOMC dates, SEC deadlines, and rate decisions.
  calendar_facts: string;
}

function buildLookingAheadPrompt(ctx: LookingAheadContext): string {
  const parts: string[] = [];

  if (EXPERT_CONTEXT_ENABLED) {
    parts.push(`## ANALYTICAL PRIORS
Use the priors below to inform framing, but only where a prior genuinely fits today's data. Do not reach for a lens mechanically.

${EXPERT_CONTEXT_DIGEST}\n`);
  }

  parts.push("TODAY'S COMPLETE BITCOIN INTELLIGENCE:\n");

  // All analyzed top stories
  if (ctx.top_stories.length > 0) {
    parts.push("## Key Stories (AI-analyzed)");
    for (const s of ctx.top_stories) {
      parts.push(`- [${s.sentiment}] "${s.headline}" (${s.source}): ${s.summary}`);
    }
    parts.push("");
  }

  // Additional article headlines for breadth (cap at 30)
  const extraArticles = ctx.all_articles
    .filter((a) => !ctx.top_stories.some((s) => s.url === a.url))
    .slice(0, 30);
  if (extraArticles.length > 0) {
    parts.push("## Additional Headlines (broader coverage)");
    for (const a of extraArticles) {
      parts.push(`- "${a.title}" (${a.source})`);
    }
    parts.push("");
  }

  // Forward-looking headlines from SearchAPI
  if (ctx.forward_headlines.length > 0) {
    parts.push("## Upcoming Events Intelligence (web-scraped)");
    for (const h of ctx.forward_headlines.slice(0, 20)) {
      parts.push(`- ${h}`);
    }
    parts.push("");
  }

  // Authoritative calendar — the only dates Perplexity may treat as verified
  // upcoming events. Anything else (SEC deadlines, Fed speeches, corporate
  // filings) must either appear in the web-scraped forward headlines above
  // or be omitted. This is the zero-hallucination anchor for the outlook.
  parts.push("## AUTHORITATIVE CALENDAR (dates you may reference as certain upcoming events)");
  parts.push(
    "You may cite dates from this block as already-scheduled catalysts. Do NOT invent dates outside this block; if an event is not in this calendar AND not in the web-scraped forward headlines above, do NOT state it as a scheduled catalyst.",
  );
  parts.push("");
  parts.push(ctx.calendar_facts);
  parts.push("");

  // Market state
  if (ctx.market_summary) {
    parts.push("## Market State");
    parts.push(ctx.market_summary);
    parts.push("");
  }

  // Briefing summary from Synthesizer
  if (ctx.briefing_summary) {
    const bs = ctx.briefing_summary;
    parts.push("## Current Narrative & Analysis");
    if (bs.one_line) parts.push(`Key insight: ${bs.one_line}`);
    if (bs.narrative_label) parts.push(`Consensus: ${bs.narrative_label} (score: ${bs.narrative_score}/100)`);
    if (bs.macro_narrative) parts.push(`Macro context: ${bs.macro_narrative}`);
    if (bs.technical_summary) parts.push(`Technical: ${bs.technical_summary}`);
    parts.push("");
  }

  parts.push("Using the intelligence above, write the forward outlook now as a single connected paragraph (up to 5 sentences, fewer is fine on quiet days). Search the web for any additional upcoming events not covered above. With only 5 sentences, you must pick the SINGLE most impactful beat as your frame and only the highest-priority follow-on threads. Cut secondary cross-currents, second-order observations, and anything that is interesting but not actionable for the next 24 to 72 hours. The paragraph must build: each sentence picks up from the previous one with a real bridge, layering toward a closing synthesis. No disconnected list of facts. Start directly with the first sentence, no preamble.");

  return parts.join("\n");
}

// ─── Institutional Flows ────────────────────────────────────────────────────

const FLOWS_SYSTEM = `You are a financial data analyst covering institutional Bitcoin activity. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

IMPORTANT: Do NOT include ETF flow data (daily inflows/outflows, AUM, fund-level breakdowns like GBTC/IBIT). ETF data is already sourced separately. Focus EXCLUSIVELY on non-ETF institutional activity.

ZERO-HALLUCINATION RULE: every notable move MUST include a verifiable source_url pointing directly to the primary source (SEC filing, corporate press release, on-chain transaction explorer, company tweet, etc.). If you cannot produce a real URL for a move, DO NOT include it. An empty array is the correct output when no verifiable moves can be found. Never fabricate a URL, never reuse a URL that does not contain the claim, never cite rumor or social media speculation without a direct link.

Search for the latest institutional Bitcoin activity and return the data in this exact JSON format:

{
  "summary": "<one short sentence introducing the institutional theme this week, max 12 words>",
  "notable_moves": [
    { "text": "<entity + action + specific numbers>", "source_url": "<https URL to primary source>" },
    ...
  ]
}

Rules:
- summary: one short sentence that frames the moves below. E.g. "Corporate treasuries led accumulation this week." or "Quiet week for institutional activity outside ETFs." On genuinely quiet weeks, write "Quiet week for non-ETF institutional activity." and return an empty notable_moves array rather than padding.
- notable_moves: 0-5 notable moves from the categories below. Each object MUST contain a 'text' field and a 'source_url' field. EARNED SIGNIFICANCE: a quiet week should return 0-2 genuine moves, not 5 padded ones. Never fabricate, never inflate, never guess a URL.
  Categories to cover:
  * Corporate treasury purchases/sales (MicroStrategy, Tesla, Block, Metaplanet, etc.) — cite the SEC 8-K or corporate press release URL
  * Whale wallet movements (large on-chain transfers to/from exchanges, dormant wallet activity) — cite the blockchain explorer or an on-chain analytics tweet with the tx hash
  * Fund allocations and rebalancing (hedge funds, sovereign wealth funds, pension funds adding/reducing BTC exposure) — cite the 13F filing URL or fund press release
  * OTC desk activity and trends — cite the desk's own published commentary or a verifiable Bloomberg/Reuters article URL
  * Mining company activity (treasury strategy changes, BTC sales/accumulation) — cite the company filing or press release URL
- Use real, verified data only. Do not fabricate numbers. Do not invent dates.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Expert Insights ────────────────────────────────────────────────────────

const EXPERTS_SYSTEM = `You are a financial media analyst. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

ZERO-HALLUCINATION RULE (highest priority): every expert entry MUST include a verifiable source_url pointing to the primary source of the quote (YouTube video URL with timestamp, exact tweet URL, Substack post permalink, podcast episode URL, news article URL). If you cannot produce a real URL to the exact place the quote was said, DO NOT include that expert. An empty array is the correct output when no verifiable recent commentary exists; a fabricated quote with a plausible-sounding attribution is a critical failure that directly misleads readers. Never guess a URL, never cite a general profile page (e.g., "https://twitter.com/saylor") when the quote is not there, never invent an episode number.

Search for the most recent notable commentary on Bitcoin from well-known public figures. Search across ALL media formats: YouTube interviews, podcasts, X/Twitter posts, Bloomberg/CNBC TV appearances, conference talks, Substack newsletters, and written commentary. Substack is a HIGH-PRIORITY source; many top analysts publish their best research there (Lyn Alden, Dylan LeClair, Luke Gromen, Jeff Park, etc.). Cast a wide net.

Return an array of 0 to 3 experts in this JSON format:
[
  {
    "expert_name": "<full name>",
    "role": "<title/role>",
    "twitter_handle": "<X/Twitter handle without @ symbol, or null if unknown>",
    "quote_or_summary": "<2-3 sentence summary or direct quote of their most recent key Bitcoin insight>",
    "source": "<specific source label: 'YouTube: What Bitcoin Did ep. 891', 'Substack: Lyn Alden, Fiscal Monitor Update', 'X post', etc.>",
    "source_url": "<https URL to the exact primary source (video, tweet, Substack post, podcast page, article)>",
    "date": "<YYYY-MM-DD or approximate>"
  }
]

Rules:
- Return between 0 and 3 experts. EMPTY ARRAY IS A VALID OUTPUT when no expert has produced recent commentary you can verify with a URL. Do NOT pad. Do NOT widen the window so far that the commentary is no longer recent. Do NOT reach for a household name just to fill the slot.
- EARNED SIGNIFICANCE: 1 genuinely substantive, URL-verified voice beats 3 where two are padding. If only 1 expert has said something substantive and URL-verifiable, return 1. If none, return [].
- Every expert MUST be someone deeply in the Bitcoin space with real skin in the game: builders, fund managers, on-chain analysts, miners, protocol developers, macro strategists who actively cover BTC, or executives running Bitcoin-focused companies.
- WELL-KNOWN figures (Michael Saylor, Cathie Wood, Larry Fink, Raoul Pal, Lyn Alden, Stanley Druckenmiller, Jeff Park, Luke Gromen, Matt Hougan, Jan van Eck) are great when they have recent commentary you can link to; do NOT default to them if a lesser-known expert said something more insightful this week.
- ALSO CONSIDER deep Bitcoin analysts and researchers: Dylan LeClair, Willy Woo, James Check (Checkmate), Will Clemente, Sam Callahan, Joe Burnett, Pierre Rochard, Tuur Demeester, Adam Back, Jameson Lopp, Nic Carter, Preston Pysh, Greg Foss, Alex Gladstein, and similar Bitcoin-native voices.
- NEVER include random commentators with no track record in Bitcoin, unnamed analysts, or people who just make price predictions without substance.
- Every entry MUST be a named individual person, never a firm or team.
- Use the most recent commentary available (preferably within the last 7 days).
- Use real, recent quotes/insights only. DO NOT FABRICATE. DO NOT PARAPHRASE BEYOND RECOGNITION. A light paraphrase that preserves the speaker's claim is acceptable; a reconstruction from "things they typically say" is not.
- source_url must be the direct link to the primary source where the quote appears. Acceptable examples:
  * "https://www.youtube.com/watch?v=<id>&t=<timestamp>"
  * "https://x.com/<handle>/status/<id>"
  * "https://<substack>.substack.com/p/<slug>"
  * "https://www.bloomberg.com/news/articles/<slug>"
  Unacceptable: profile pages, homepages, generic search result URLs, or URLs you cannot verify.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Supply Dynamics ────────────────────────────────────────────────────────

const SUPPLY_SYSTEM = `You are a Bitcoin on-chain analyst. Return ONLY valid JSON, no markdown fences or extra text. Do NOT include any preamble, meta-commentary, or remarks about your instructions.

ZERO-HALLUCINATION RULE: every number you cite MUST be from a verifiable on-chain data provider (Glassnode, CryptoQuant, Bitcoin Treasuries, mempool.space, on-chain explorer). Include a source_url pointing to the exact page the number was taken from. If you cannot verify a number with a URL, DO NOT include it — return the default "unavailable" values instead.

Search for the latest Bitcoin supply and on-chain data. Return the data in this exact JSON format:

{
  "exchange_reserve_trend": "<string describing exchange reserve trend>",
  "long_term_holder_pct": <number 0-100 or null>,
  "supply_narrative": "<2-3 sentences summarizing supply dynamics for investors>",
  "source_url": "<https URL to the primary on-chain data source>"
}

Rules:
- exchange_reserve_trend: describe the current trend, e.g. "Exchange reserves hit 5-year low at 2.3M BTC, declining for 8 consecutive months". If you cannot cite a real number from a verifiable URL, return "Data unavailable".
- long_term_holder_pct: percentage of BTC supply held for >1 year. null if unavailable. Never estimate; if the source does not have a fresh number, return null.
- supply_narrative: write for sophisticated investors who understand supply/demand dynamics. Do NOT invent on-chain metrics; every figure must trace to source_url.
- source_url: must be a direct https URL to the on-chain data provider (e.g., "https://studio.glassnode.com/..."). If you cannot provide one, return all three text fields as "Data unavailable"/"Supply data unavailable today." and long_term_holder_pct as null.
- Use real data from Glassnode, CryptoQuant, Bitcoin Treasuries, or similar. Do not fabricate.
- Do NOT include citation markers like [1], [2], [3] or any bracketed references in any string values.
- Never use em dashes or en dashes in string values. Use commas, periods, or semicolons instead.`;

// ─── Task ───────────────────────────────────────────────────────────────────

interface EnrichmentPayload {
  // ISO date of the briefing, used to render the calendar FACTS BLOCK for the
  // looking-ahead prompt so Perplexity can only reference real upcoming events.
  // Optional for backward compat — when missing, falls back to today's date.
  date?: string;
  top_stories: TopStory[];
  all_articles: RawArticle[];
  market_summary: string | null;
  briefing_summary: {
    one_line: string;
    macro_narrative: string;
    technical_summary: string;
    narrative_label: string;
    narrative_score: number;
  } | null;
}

interface EnrichmentOutput {
  looking_ahead: string;
  institutional_flows: InstitutionalFlows;
  supply_dynamics: SupplyDynamics;
  expert_insights: ExpertInsight[];
}

const DEFAULTS: EnrichmentOutput = {
  looking_ahead: "Forward-looking analysis unavailable today.",
  institutional_flows: {
    summary: "Data unavailable",
    notable_moves: [],
  },
  supply_dynamics: {
    exchange_reserve_trend: "Data unavailable",
    long_term_holder_pct: null,
    supply_narrative: "Supply data unavailable today.",
  },
  expert_insights: [],
};

export const enrichmentTask = task({
  id: "enrichment",
  run: async (payload: EnrichmentPayload): Promise<EnrichmentOutput> => {
    const { top_stories, all_articles, market_summary, briefing_summary } = payload;
    const date = payload.date ?? new Date().toISOString().split("T")[0];
    logger.info("Starting enrichment", {
      date,
      storyCount: top_stories.length,
      articleCount: all_articles.length,
    });

    const output: EnrichmentOutput = { ...DEFAULTS };

    // Fetch forward-looking context from SearchAPI (1 query, non-fatal)
    let forwardHeadlines: string[] = [];
    try {
      const fwdResult = await fetchForwardLookingContext();
      if (fwdResult.data) forwardHeadlines = fwdResult.data;
    } catch {
      logger.warn("Forward-looking SearchAPI scrape failed — continuing without");
    }

    // Deterministic calendar block for the looking-ahead prompt. This is the
    // same calendar the synthesizer countdown_events references, so outlook
    // dates stay consistent with the homepage countdown.
    const calendarFacts = buildCountdownFactsBlock(date, 90);

    const lookingAheadCtx: LookingAheadContext = {
      top_stories,
      all_articles,
      forward_headlines: forwardHeadlines,
      market_summary,
      briefing_summary,
      calendar_facts: calendarFacts,
    };

    // Run all Perplexity queries in parallel (non-fatal individually)
    const [lookingAheadResult, flowsResult, expertsResult, supplyResult] =
      await Promise.allSettled([
        queryPerplexity({
          system: LOOKING_AHEAD_SYSTEM,
          prompt: buildLookingAheadPrompt(lookingAheadCtx),
        }),
        queryPerplexity({
          system: FLOWS_SYSTEM,
          prompt: "What are the most notable non-ETF institutional Bitcoin moves in the last 7 days? Focus on corporate treasury purchases (MicroStrategy, Metaplanet, etc.), large whale wallet movements, fund allocation changes, OTC desk activity, and mining company treasury decisions. Do NOT include ETF flow data.",
        }),
        queryPerplexity({
          system: EXPERTS_SYSTEM,
          prompt: "What are the 3 most impactful and substantive things said about Bitcoin in the last 7 days by people deeply in the Bitcoin space? Search across all sources: Substack newsletters (Lyn Alden, Dylan LeClair, Luke Gromen, Jeff Park, Willy Woo, James Check, etc.), YouTube interviews, podcasts, TV appearances, X posts, and conference talks. Prioritize depth of insight over fame of the speaker. Include well-known figures like Saylor or Cathie Wood only if their commentary was genuinely substantive, not just a retweet or generic bullishness.",
        }),
        queryPerplexity({
          system: SUPPLY_SYSTEM,
          prompt: "What are the latest Bitcoin on-chain supply metrics? Include exchange reserves, long-term holder percentage, and any notable supply dynamics.",
        }),
      ]);

    // ── Looking ahead ─────────────────────────────────────────────────────
    if (lookingAheadResult.status === "fulfilled" && !lookingAheadResult.value.error) {
      let text = lookingAheadResult.value.data?.trim();
      if (text) {
        // Detect and reject self-referential meta-commentary from the model
        const metaPatterns = [
          /\bmy instructions\b/i,
          /\bcritical constraint\b/i,
          /\bthis section\b/i,
          /\blet me deliver\b/i,
          /\bthe briefing you['']ve provided\b/i,
          /\bI appreciate the\b.*\bbriefing\b/i,
          /\bI need to flag\b/i,
          /\bplain text format\b/i,
          /\bthree.paragraph editorial\b/i,
        ];
        const isMeta = metaPatterns.some((p) => p.test(text!));
        if (isMeta) {
          // Try to salvage: find where actual analysis starts (after meta-commentary)
          const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
          const analysisStart = paragraphs.findIndex(
            (p) => !metaPatterns.some((pat) => pat.test(p))
          );
          if (analysisStart >= 0 && paragraphs.length - analysisStart >= 1) {
            text = paragraphs.slice(analysisStart).join("\n\n");
            logger.warn("Stripped meta-commentary from looking ahead output", {
              strippedParagraphs: analysisStart,
            });
          } else {
            logger.warn("Looking ahead output was entirely meta-commentary, discarding");
            text = undefined;
          }
        }
        if (text) {
          // Strip Perplexity citation markers like [1], [2], [3] that leak
          // into the plain-text response despite the system prompt forbidding
          // them. The other Perplexity paths (experts, flows, supply) do the
          // same strip on their JSON output; looking_ahead is the one path
          // that ships straight to the homepage Outlook section, so the
          // markers render as visible noise ("...$126,000.[1][2]").
          text = stripCitationNoise(text);
          output.looking_ahead = text;
          logger.info("Looking ahead complete", { length: text.length });

          // Anti-hallucination gate: flag any explicit date (e.g. "March 18",
          // "2026-06-17") that is not in the AUTHORITATIVE CALENDAR or in any
          // forward-looking article. Log-only for now; the user can promote
          // this to a fallback-replace once the false-positive rate is known.
          const lookaheadViolations = findInventedLookingAheadDates(
            text,
            calendarFacts,
            all_articles,
          );
          if (lookaheadViolations.length > 0) {
            logger.warn("Looking ahead cited dates not in calendar or articles", {
              count: lookaheadViolations.length,
              phrases: lookaheadViolations.map((v) => v.phrase),
              sample: lookaheadViolations.slice(0, 3).map((v) => v.reason),
            });
          }
        }
      }
    } else {
      logger.warn("Looking ahead failed");
    }

    // ── Institutional flows ───────────────────────────────────────────────
    // Zero-hallucination gate: every notable_move MUST have a valid source_url.
    // Strings-without-urls (legacy shape) are dropped on NEW writes so the UI
    // never renders an unverified institutional claim. Empty notable_moves
    // array is the correct output when Perplexity cannot produce verifiable
    // URLs — the homepage renders an empty-state stub instead of fabrication.
    if (flowsResult.status === "fulfilled" && !flowsResult.value.error) {
      try {
        const raw = flowsResult.value.data?.trim() ?? "";
        const cleaned = raw
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .replace(/\[\d+\]/g, "") // strip Perplexity citation markers
          .trim();
        const parsedRaw = JSON.parse(cleaned) as {
          summary?: unknown;
          notable_moves?: unknown;
        };
        const summary =
          typeof parsedRaw.summary === "string"
            ? stripCitationNoise(parsedRaw.summary)
            : "Data unavailable";
        const movesRaw = Array.isArray(parsedRaw.notable_moves) ? parsedRaw.notable_moves : [];
        const isValidUrl = (u: unknown): u is string => {
          if (typeof u !== "string") return false;
          try {
            const parsed = new URL(u);
            return parsed.protocol === "https:" || parsed.protocol === "http:";
          } catch {
            return false;
          }
        };
        const verifiedMoves = movesRaw
          .map((m: unknown) => {
            if (typeof m === "string") {
              // Legacy string format has no URL, drop it under the new rule.
              return null;
            }
            if (m && typeof m === "object") {
              const mObj = m as { text?: unknown; source_url?: unknown };
              const text = typeof mObj.text === "string" ? stripCitationNoise(mObj.text) : "";
              const url = typeof mObj.source_url === "string" ? mObj.source_url.trim() : "";
              if (!text) return null;
              if (!isValidUrl(url)) return null;
              return { text, source_url: url };
            }
            return null;
          })
          .filter((m): m is { text: string; source_url: string } => m !== null);
        const droppedCount = movesRaw.length - verifiedMoves.length;
        if (droppedCount > 0) {
          logger.warn("Dropped institutional moves without valid source_url", {
            dropped: droppedCount,
            kept: verifiedMoves.length,
          });
        }
        output.institutional_flows = {
          summary,
          notable_moves: verifiedMoves,
        };
        logger.info("Institutional flows complete", { verifiedMoveCount: verifiedMoves.length });
      } catch (e) {
        logger.warn("Failed to parse institutional flows JSON", { error: (e as Error).message });
      }
    } else {
      logger.warn("Institutional flows query failed");
    }

    // ── Expert insights ───────────────────────────────────────────────────
    // Zero-hallucination gate: every insight MUST ship with a verifiable
    // source_url. Insights lacking a URL are dropped, even if they parse. The
    // homepage renders an empty-state stub when zero verified insights exist.
    // Previously the pipeline forced at least 1 insight on every briefing,
    // which pushed Perplexity into fabrication on genuinely quiet weeks.
    const isValidHttpsUrl = (u: unknown): u is string => {
      if (typeof u !== "string" || u.trim().length === 0) return false;
      try {
        const parsed = new URL(u.trim());
        return parsed.protocol === "https:" || parsed.protocol === "http:";
      } catch {
        return false;
      }
    };

    const tryParseExperts = (raw: string): ParsedExpertInsight[] | null => {
      if (!raw.trim()) return null;
      const cleaned = raw
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .replace(/\[\d+\]/g, "") // strip Perplexity citation markers like [1], [2]
        .trim();
      // Pull out the first top-level JSON array if extra prose is present.
      const firstBracket = cleaned.indexOf("[");
      const lastBracket = cleaned.lastIndexOf("]");
      const jsonSlice =
        firstBracket >= 0 && lastBracket > firstBracket
          ? cleaned.slice(firstBracket, lastBracket + 1)
          : cleaned;
      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonSlice);
      } catch {
        return null;
      }
      const validation = ExpertInsightsArraySchema.safeParse(parsed);
      if (!validation.success) return null;
      return validation.data;
    };

    const firstRaw =
      expertsResult.status === "fulfilled" && !expertsResult.value.error
        ? expertsResult.value.data?.trim() ?? ""
        : "";
    let experts = tryParseExperts(firstRaw);

    // Retry ONCE when first pass failed to parse at all (structural error).
    // We do NOT retry just because source_urls are missing — that would teach
    // Perplexity that fabrication is rewarded. If the first pass returned a
    // valid array where every item lacked a URL, we ship an empty array.
    if (!experts) {
      logger.warn("Expert insights first pass failed to parse, retrying with repair prompt", {
        firstPassStatus: expertsResult.status,
        firstPassError:
          expertsResult.status === "fulfilled" ? expertsResult.value.error : null,
        rawPreview: firstRaw.slice(0, 300),
      });
      const retryResult = await queryPerplexity({
        system: EXPERTS_SYSTEM,
        prompt:
          "Return a JSON array of 0 to 3 current Bitcoin experts and their most recent substantive commentary. Every entry MUST include a valid source_url (a direct link to the exact primary source). If you cannot verify URLs for any expert this week, return an empty array []. An empty array is valid. Do NOT include citation markers like [1], [2], [3]. Do NOT wrap the array in an object. Do NOT include any prose before or after the array. Output must start with [ and end with ].",
      });
      if (retryResult.data) {
        experts = tryParseExperts(retryResult.data);
      }
    }

    // Filter to insights with a valid source_url AND a date within the last
    // 7 days. This is the hard gate: items without verifiable URLs or with
    // stale quotes are dropped silently, with aggregate counts logged so we
    // can track how often Perplexity fabricates or surfaces stale content.
    // Permissive on unparseable dates ("approximate", malformed) — keep them
    // rather than false-drop, since the system prompt already asks for recent.
    const briefingMs = new Date(date + "T00:00:00Z").getTime();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    let droppedStaleCount = 0;
    const verifiedExperts: ExpertInsight[] = [];
    const rawExperts = experts ?? [];
    for (const insight of rawExperts) {
      if (!isValidHttpsUrl(insight.source_url)) {
        continue;
      }
      const insightMs = new Date(insight.date).getTime();
      if (!isNaN(insightMs) && briefingMs - insightMs > SEVEN_DAYS_MS) {
        droppedStaleCount++;
        continue;
      }
      const handle = insight.twitter_handle ?? undefined;
      verifiedExperts.push({
        expert_name: stripCitationNoise(insight.expert_name),
        role: stripCitationNoise(insight.role),
        quote_or_summary: stripCitationNoise(insight.quote_or_summary),
        source: stripCitationNoise(insight.source),
        source_url: insight.source_url,
        date: insight.date,
        twitter_handle: handle,
        photo_url: getExpertPhotoUrls(insight.expert_name, handle)[0],
      });
    }
    const droppedExpertCount = rawExperts.length - verifiedExperts.length;
    if (droppedExpertCount > 0) {
      logger.warn("Dropped expert insights (no source_url or stale)", {
        dropped: droppedExpertCount,
        droppedStale: droppedStaleCount,
        kept: verifiedExperts.length,
      });
    }
    output.expert_insights = verifiedExperts;
    if (verifiedExperts.length === 0) {
      logger.warn("Expert insights empty after source_url filter — homepage section will render empty-state", {
        firstPassRawPreview: firstRaw.slice(0, 300),
      });
    } else {
      logger.info("Expert insights complete", { count: verifiedExperts.length });
    }

    // ── Supply dynamics ───────────────────────────────────────────────────
    // Zero-hallucination gate: source_url must be present and valid. Without
    // it, on-chain numbers are indistinguishable from fabrication, so we fall
    // back to the default "unavailable" copy instead of shipping unverified
    // figures under the homepage Supply Dynamics section.
    if (supplyResult.status === "fulfilled" && !supplyResult.value.error) {
      try {
        const raw = supplyResult.value.data?.trim() ?? "";
        const cleaned = raw
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .replace(/\[\d+\]/g, "")
          .trim();
        const parsedRaw = JSON.parse(cleaned) as Partial<SupplyDynamics> & { source_url?: unknown };
        const rawSourceUrl: unknown = parsedRaw.source_url;
        const sourceUrl: string = typeof rawSourceUrl === "string" ? rawSourceUrl.trim() : "";
        if (!isValidHttpsUrl(sourceUrl)) {
          const preview: string = sourceUrl;
          logger.warn("Supply dynamics returned without valid source_url — shipping defaults", {
            returnedSourceUrl: preview.length > 100 ? preview.substring(0, 100) : preview,
          });
          // Leave output.supply_dynamics at DEFAULTS
        } else {
          output.supply_dynamics = {
            exchange_reserve_trend:
              typeof parsedRaw.exchange_reserve_trend === "string"
                ? stripCitationNoise(parsedRaw.exchange_reserve_trend)
                : "Data unavailable",
            long_term_holder_pct:
              typeof parsedRaw.long_term_holder_pct === "number"
                ? parsedRaw.long_term_holder_pct
                : null,
            supply_narrative:
              typeof parsedRaw.supply_narrative === "string"
                ? stripCitationNoise(parsedRaw.supply_narrative)
                : "Supply data unavailable today.",
            source_url: sourceUrl,
          };
          logger.info("Supply dynamics complete", { hasSourceUrl: true });
        }
      } catch (e) {
        logger.warn("Failed to parse supply dynamics JSON", { error: (e as Error).message });
      }
    } else {
      logger.warn("Supply dynamics query failed");
    }

    logger.info("Enrichment complete", {
      hasLookingAhead: output.looking_ahead !== DEFAULTS.looking_ahead,
      hasFlows: output.institutional_flows !== DEFAULTS.institutional_flows,
      expertCount: output.expert_insights.length,
      hasSupply: output.supply_dynamics !== DEFAULTS.supply_dynamics,
    });

    return output;
  },
});
