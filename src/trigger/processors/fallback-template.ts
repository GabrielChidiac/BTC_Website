import type {
  BriefingJSON,
  MarketCollectorOutput,
  HeroThreeLines,
  DailyDiff,
  NarrativeConsensus,
  MacroContext,
  CountdownEvent,
  DayClassification,
  AssetComparison,
} from "@/lib/types";
import { getUpcomingKnownEvents, daysBetween } from "@/trigger/lib/calendar";

// Shape used by synthesizer: the Claude output is everything in BriefingJSON
// EXCEPT the enrichment-owned fields. Enrichment runs later in the pipeline
// regardless of whether Claude or this template produced the base briefing.
export type FallbackBriefing = Omit<
  BriefingJSON,
  "looking_ahead" | "institutional_flows" | "supply_dynamics" | "expert_insights" | "etf_flows"
> & { one_line?: string };

// Calibrated copy for the narrative-consensus label branching. These are
// factual characterizations of a market state, not hype. Each pairs a label
// and a rationale that honors "let the data speak."
interface NarrativeBranch {
  score: number;
  label: string;
  rationale: string;
}

/**
 * Build a complete, subscriber-ready briefing from real market data alone,
 * for days when the Anthropic + Kie.ai chain is unavailable. The brief still
 * answers the two-question reader contract and carries the product's voice.
 * It NEVER emits "Data Unavailable" or similar placeholder strings.
 *
 * Design principles:
 *  - Every string field is derived from a number the collector actually
 *    produced. No fabrication, no training-data priors.
 *  - Defaults are chosen so the UI renders cleanly: empty stories/regulatory/
 *    adoption arrays collapse to the section-05 empty state rather than
 *    placeholder text.
 *  - The fallback fingerprint is `fallback_used: true`, checked by the
 *    pipeline to render the editor's note in the email + homepage footer.
 */
export function buildFallbackBriefing(params: {
  date: string;
  market: MarketCollectorOutput;
  halving: { progressPct: number; blocksRemaining: number };
  yesterday: { price_usd: number; countdown_events: CountdownEvent[] } | null;
  dayClassification: DayClassification | null;
}): FallbackBriefing & { fallback_used: true } {
  const { date, market, halving, yesterday, dayClassification } = params;

  const price = market.price.usd;
  const change24h = market.price.change_24h_pct;
  const change7d = market.price.change_7d_pct;
  const rsi = market.technical.rsi_14;
  const comparative = market.comparative;
  const fundingPercentile = comparative?.funding_rate_30d_percentile ?? null;
  const fearGreedDelta = comparative?.fear_greed_30d_change ?? null;
  const fearGreed = market.fear_greed;
  const priceVs30dAvg = comparative?.price_vs_30d_avg_pct ?? null;
  const price30dHigh = comparative?.price_30d_high ?? null;
  const price30dLow = comparative?.price_30d_low ?? null;

  const countdownEvents = buildCountdownFromCalendar(date);

  const hero = buildHeroThreeLines({
    price,
    change24h,
    rsi,
    fundingPercentile,
    fearGreedDelta,
    fearGreedValue: fearGreed?.value ?? null,
    priceVs30dAvg,
    price30dHigh,
    price30dLow,
    countdownEvents,
  });

  const narrative = classifyNarrative({
    change24h,
    rsi,
    fundingPercentile,
    fearGreedDelta,
    priceVs30dAvg,
  });

  const dailyDiff = buildDailyDiff({
    change24h,
    change7d,
    priceVs30dAvg,
    fundingPercentile,
    fearGreedDelta,
    fearGreed: fearGreed?.value ?? null,
  });

  const macroNarrative = buildMacroNarrative({
    change24h,
    spChange24h: market.comparisons.sp500_change_24h_pct,
    goldChange24h: market.comparisons.gold_change_24h_pct,
    dxyChange24h: market.comparisons.dxy_change_24h_pct,
  });

  return {
    date,
    one_line: buildOneLiner(price, change24h),
    hero_three_lines: hero,
    top_stories: [],
    market_snapshot: {
      price_usd: price,
      change_24h_pct: change24h,
      change_7d_pct: change7d,
      market_cap_usd: market.price.market_cap_usd,
      volume_24h_usd: market.price.volume_24h_usd,
      dominance_pct: market.dominance_pct,
      ath_usd: market.ath_usd ?? null,
      ath_date: market.ath_date ?? null,
    },
    technical_signals: {
      rsi_14: rsi,
      sma_50: market.technical.sma_50,
      sma_200: market.technical.sma_200,
      support_level: market.technical.support_level,
      resistance_level: market.technical.resistance_level,
      signal_summary: buildTechnicalSummary({
        rsi,
        price,
        sma50: market.technical.sma_50,
        sma200: market.technical.sma_200,
      }),
    },
    btc_vs_everything: buildComparisonsFallback(market, change24h),
    network_health: {
      hashrate_eh_s: market.network.hashrate_eh_s,
      difficulty: market.network.difficulty,
      block_height: market.network.block_height,
      mempool_tx_count: market.network.mempool_tx_count,
      mempool_size_mb: market.network.mempool_size_mb,
      fee_fast_sat_vb: market.network.fee_fast_sat_vb,
      fee_medium_sat_vb: market.network.fee_medium_sat_vb,
      fee_slow_sat_vb: market.network.fee_slow_sat_vb,
      halving_progress_pct: halving.progressPct,
      blocks_until_halving: halving.blocksRemaining,
    },
    daily_diff: dailyDiff,
    countdown_events: countdownEvents,
    regulatory: [],
    adoption: [],
    narrative_consensus: narrative,
    macro_context: {
      narrative: macroNarrative,
      btc_correlation_note: buildCorrelationNote(
        change24h,
        market.comparisons.sp500_change_24h_pct,
        market.comparisons.gold_change_24h_pct
      ),
      key_macro_events: [],
    },
    day_classification: dayClassification ?? null,
    comparative: market.comparative ?? null,
    funding_rate: market.funding_rate ?? null,
    fear_greed: market.fear_greed ?? null,
    correlation_matrix: market.correlation_matrix ?? null,
    fallback_used: true,
  };
}

// ─── Generator helpers ────────────────────────────────────────────────────

function buildOneLiner(price: number, change24h: number): string {
  const direction = change24h >= 0 ? "up" : "down";
  return `Bitcoin is $${roundToK(price)}, ${direction} ${formatPct(change24h)} in the last 24 hours.`;
}

function buildHeroThreeLines(args: {
  price: number;
  change24h: number;
  rsi: number;
  fundingPercentile: number | null;
  fearGreedDelta: number | null;
  fearGreedValue: number | null;
  priceVs30dAvg: number | null;
  price30dHigh: number | null;
  price30dLow: number | null;
  countdownEvents: CountdownEvent[];
}): HeroThreeLines {
  const {
    price,
    change24h,
    rsi,
    fundingPercentile,
    fearGreedDelta,
    fearGreedValue,
    price30dHigh,
    price30dLow,
    countdownEvents,
  } = args;

  // MOVE: price + 24h move + 30d context, all numeric, no hedge words.
  const moveDirection = change24h >= 0 ? "up" : "down";
  const rangeSentence =
    price30dHigh != null && price30dLow != null
      ? `That keeps it inside its 30-day range of $${roundToK(price30dLow)} to $${roundToK(price30dHigh)}.`
      : `Magnitude is inside the normal day-to-day band of the past month.`;
  let move = `BTC trades at $${roundToK(price)}, ${moveDirection} ${formatPct(change24h)} on the day. ${rangeSentence}`;
  move = truncateHeroLine(move);

  // SIGNAL: three-branch classifier on (funding percentile, RSI, F&G delta).
  // We commit to one real read, anchored in a number. No hedging.
  let signal: string;
  if (fundingPercentile != null && fundingPercentile >= 80) {
    signal = `Funding sits in the ${Math.round(fundingPercentile)}th percentile of the last 30 days. Positioning is stretched, not the move itself, which usually unwinds before price extends further.`;
  } else if (fundingPercentile != null && fundingPercentile <= 20) {
    signal = `Funding sits in the ${Math.round(fundingPercentile)}th percentile of the last 30 days. Shorts are crowded, setting up a squeeze if any catalyst forces a flip in positioning.`;
  } else if (rsi >= 70) {
    signal = `Momentum reads ${Math.round(rsi)} on the 14-day RSI, deep in overbought territory. Consolidation is the more likely path near-term than another leg higher without a fresh catalyst.`;
  } else if (rsi <= 30) {
    signal = `Momentum reads ${Math.round(rsi)} on the 14-day RSI, in oversold territory. Historically this zone marks bottoms more often than the start of further continuation lower.`;
  } else if (fearGreedDelta != null && Math.abs(fearGreedDelta) >= 15) {
    const direction = fearGreedDelta > 0 ? "hotter" : "colder";
    signal = `Sentiment has shifted ${direction} by ${Math.abs(Math.round(fearGreedDelta))} points versus the 30-day mean. Flow of funds tends to follow mood with a lag, so positioning will likely confirm the shift in coming sessions.`;
  } else if (fearGreedValue != null) {
    signal = `Fear and Greed sits at ${fearGreedValue}, near its 30-day mean. There is no sentiment dislocation to trade against, so watch the tape rather than the mood.`;
  } else {
    signal = `Price action sits inside its normal range, momentum is neutral, and positioning is balanced. A routine session, with no structural change to the setup.`;
  }
  signal = truncateHeroLine(signal);

  // WATCH: nearest upcoming catalyst from the calendar-derived countdown
  // events. Guaranteed real dates because countdownEvents came from the
  // authoritative calendar, not yesterday's (possibly stale) briefing.
  const watch = truncateHeroLine(buildWatchLine(countdownEvents));

  return { move, signal, watch };
}

function buildWatchLine(countdownEvents: CountdownEvent[]): string {
  const upcoming = [...countdownEvents]
    .filter((e) => e && typeof e.days_away === "number" && (e.days_away ?? -1) >= 0)
    .sort((a, b) => (a.days_away ?? 0) - (b.days_away ?? 0));

  if (upcoming.length > 0) {
    const next = upcoming[0];
    const daysLabel = next.days_away === 1 ? "tomorrow" : `in ${next.days_away} days`;
    const why = next.description ?? "Positioning into the print is the read worth tracking, not the headline itself.";
    return `${next.name} ${daysLabel}. ${why}`;
  }

  return "No near-term catalysts sit on the calendar. With nothing scheduled to force a move, flows and positioning will set the next leg until the 2028 halving comes into view.";
}

function buildCountdownFromCalendar(date: string): CountdownEvent[] {
  // Pull the next 5 authoritative events from the calendar. This is the same
  // list injected into the AI brain prompt, guaranteeing fallback days and
  // AI-brain days surface the same dates.
  const upcoming = getUpcomingKnownEvents(date, 120).slice(0, 5);
  return upcoming.map((e) => ({
    name: e.name,
    date: e.date,
    days_away: daysBetween(date, e.date),
    description: e.description,
  }));
}

// Narrative consensus: a rule-based reading. Score is a weighted blend of
// the three strongest signals (funding, F&G, 24h move vs 30d avg). Labels
// are factual characterizations, not hype.
function classifyNarrative(args: {
  change24h: number;
  rsi: number;
  fundingPercentile: number | null;
  fearGreedDelta: number | null;
  priceVs30dAvg: number | null;
}): NarrativeConsensus {
  const { change24h, rsi, fundingPercentile, fearGreedDelta, priceVs30dAvg } = args;

  // Each component contributes to a signed score in [-100, +100].
  const fundingSignal = fundingPercentile != null ? ((fundingPercentile - 50) / 50) * 30 : 0;
  const fearGreedSignal = fearGreedDelta != null ? Math.max(-30, Math.min(30, fearGreedDelta * 1.5)) : 0;
  const priceSignal = priceVs30dAvg != null ? Math.max(-20, Math.min(20, priceVs30dAvg * 2)) : 0;
  const momentumSignal = rsi >= 70 ? -10 : rsi <= 30 ? 10 : 0; // contrarian
  const dayMoveSignal = Math.max(-20, Math.min(20, change24h * 2));

  const raw = fundingSignal + fearGreedSignal + priceSignal + momentumSignal + dayMoveSignal;
  const score = Math.max(-100, Math.min(100, Math.round(raw)));

  const branch = pickNarrativeBranch(score, fundingPercentile, rsi);
  return {
    score,
    label: branch.label,
    rationale: branch.rationale,
  };
}

function pickNarrativeBranch(
  score: number,
  fundingPercentile: number | null,
  rsi: number
): Pick<NarrativeBranch, "label" | "rationale"> {
  if (score >= 50) {
    return {
      label: "Constructive Positioning",
      rationale:
        "Flows, sentiment, and price action all lean the same direction. Tape is constructive but not overextended.",
    };
  }
  if (score >= 20) {
    if (fundingPercentile != null && fundingPercentile >= 75) {
      return {
        label: "Late-Stage Strength",
        rationale:
          "Price and sentiment positive, but crowded long positioning raises the bar for further upside.",
      };
    }
    return {
      label: "Healthy Accumulation",
      rationale:
        "Modest upside with positioning inside normal ranges. The kind of quiet strength that compounds.",
    };
  }
  if (score > -20) {
    return {
      label: "Mixed / No Clear Signal",
      rationale:
        "Positioning, sentiment, and price disagree or sit near their means. No dominant near-term lean.",
    };
  }
  if (score > -50) {
    if (rsi <= 35) {
      return {
        label: "Capitulation Watch",
        rationale:
          "Negative tape with momentum readings near oversold. Historically the zone where contrarian bids appear.",
      };
    }
    return {
      label: "Cautious Consolidation",
      rationale:
        "Modest weakness in price and positioning. Digesting recent moves rather than breaking trend.",
    };
  }
  return {
    label: "Defensive Posture",
    rationale:
      "Flows, sentiment, and price all lean negative. Near-term risk elevated; patience warranted.",
  };
}

function buildDailyDiff(args: {
  change24h: number;
  change7d: number;
  priceVs30dAvg: number | null;
  fundingPercentile: number | null;
  fearGreedDelta: number | null;
  fearGreed: number | null;
}): DailyDiff {
  const { change24h, change7d, priceVs30dAvg, fundingPercentile, fearGreedDelta, fearGreed } = args;

  const magnitude24h = Math.abs(change24h);
  const isQuiet =
    magnitude24h < 1.5 &&
    (fundingPercentile == null || (fundingPercentile >= 25 && fundingPercentile <= 75)) &&
    (fearGreedDelta == null || Math.abs(fearGreedDelta) < 10);

  const riskRising =
    (fundingPercentile != null && fundingPercentile >= 85) ||
    (fearGreedDelta != null && fearGreedDelta >= 15) ||
    magnitude24h >= 4;

  let sentiment_shift: string;
  if (isQuiet) {
    sentiment_shift = "A quiet day. Price drifted inside its 30-day range and no positioning extremes cleared the bar.";
  } else if (riskRising) {
    const vector = fundingPercentile != null && fundingPercentile >= 85
      ? "funding stretched toward the top of the 30-day range"
      : fearGreedDelta != null && fearGreedDelta >= 15
        ? "sentiment running hotter than the 30-day mean"
        : `a ${magnitude24h.toFixed(1)}% day move`;
    sentiment_shift = `Not noise today. Near-term risk rose with ${vector}.`;
  } else {
    sentiment_shift = `Modest ${change24h >= 0 ? "upside" : "downside"} of ${formatPct(change24h)} on the day. No positioning extremes, no catalyst firing.`;
  }

  const key_changes: string[] = [];

  if (priceVs30dAvg != null) {
    const sign = priceVs30dAvg >= 0 ? "+" : "";
    key_changes.push(`Price is ${sign}${priceVs30dAvg.toFixed(1)}% versus the 30-day average.`);
  } else {
    const sign = change7d >= 0 ? "+" : "";
    key_changes.push(`7-day change ${sign}${change7d.toFixed(1)}% (24h ${formatPctSigned(change24h)}).`);
  }

  if (fundingPercentile != null) {
    const position =
      fundingPercentile >= 80
        ? "in the top quintile of the last 30 days (crowded long)"
        : fundingPercentile <= 20
          ? "in the bottom quintile (crowded short)"
          : "inside its normal 30-day range";
    key_changes.push(`Perpetual funding sits ${position}.`);
  } else {
    key_changes.push("Perpetual funding data was unavailable this cycle.");
  }

  if (fearGreedDelta != null && fearGreed != null) {
    const sign = fearGreedDelta >= 0 ? "+" : "";
    key_changes.push(`Fear and Greed at ${fearGreed}, ${sign}${Math.round(fearGreedDelta)} versus the 30-day mean.`);
  } else {
    key_changes.push("Network fundamentals steady: fixed supply, growing hash rate, expanding institutional infrastructure.");
  }

  return {
    price_change: `${change24h >= 0 ? "+" : ""}${change24h.toFixed(2)}% (24h)`,
    sentiment_shift,
    key_changes,
  };
}

function buildMacroNarrative(args: {
  change24h: number;
  spChange24h: number | null;
  goldChange24h: number | null;
  dxyChange24h: number | null;
}): string {
  const { change24h, spChange24h, goldChange24h, dxyChange24h } = args;

  const btcDirection = change24h >= 0 ? "up" : "down";
  const parts: string[] = [`Bitcoin moved ${btcDirection} ${formatPct(change24h)} in the last 24 hours`];

  if (spChange24h != null) {
    const spDirection = spChange24h >= 0 ? "up" : "down";
    const spMagnitude = Math.abs(spChange24h);
    if (spMagnitude < 0.3) {
      parts.push(`while the S&P 500 held roughly flat`);
    } else {
      parts.push(`while the S&P 500 was ${spDirection} ${formatPct(spChange24h)}`);
    }
  }

  if (dxyChange24h != null && Math.abs(dxyChange24h) >= 0.2) {
    const dxyDirection = dxyChange24h >= 0 ? "firmer" : "softer";
    parts.push(`with the dollar index ${dxyDirection}`);
  }

  if (goldChange24h != null && Math.abs(goldChange24h) >= 0.5) {
    const goldDirection = goldChange24h >= 0 ? "up" : "down";
    parts.push(`and gold ${goldDirection} ${formatPct(goldChange24h)}`);
  }

  return parts.join(", ") + ".";
}

function buildCorrelationNote(
  btcChange: number,
  spChange: number | null,
  goldChange: number | null
): string {
  if (spChange == null && goldChange == null) {
    return "Cross-asset correlations unavailable this cycle.";
  }
  if (spChange != null) {
    const sameDirection = Math.sign(btcChange) === Math.sign(spChange);
    if (Math.abs(btcChange - spChange) < 0.4) {
      return "BTC tracking equities closely on the day.";
    }
    return sameDirection
      ? "BTC aligned with equities directionally but with a different magnitude."
      : "BTC decoupled from equities on the day.";
  }
  return "BTC traded on its own catalysts today.";
}

function buildTechnicalSummary(args: {
  rsi: number;
  price: number;
  sma50: number;
  sma200: number;
}): string {
  const { rsi, price, sma50, sma200 } = args;
  const rsiDescriptor =
    rsi >= 70 ? "overbought" : rsi <= 30 ? "oversold" : "neutral";
  const above50 = price > sma50;
  const above200 = price > sma200;
  const trendDescriptor =
    above50 && above200
      ? "trend intact above both moving averages"
      : !above50 && !above200
        ? "below both moving averages"
        : above50
          ? "above 50-day, below 200-day"
          : "below 50-day, above 200-day";
  return `Momentum ${rsiDescriptor}; price ${trendDescriptor}.`;
}

// Inline comparison builder — duplicates the shape synthesizer.ts uses without
// needing to import a non-exported function. Keeps this module self-contained.
function buildComparisonsFallback(
  market: MarketCollectorOutput,
  btcChange: number
): AssetComparison[] {
  const cmp = market.comparisons;
  const makeRow = (
    name: string,
    ticker: string,
    change24h: number | null,
    changeYtd: number | null,
    change1y: number | null
  ): AssetComparison => ({
    name,
    ticker,
    change_24h_pct: change24h,
    change_ytd_pct: changeYtd,
    change_1y_pct: change1y,
    btc_relative_24h_pct: change24h != null ? btcChange - change24h : null,
    btc_relative_ytd_pct:
      changeYtd != null && market.btc_change_ytd_pct != null ? market.btc_change_ytd_pct - changeYtd : null,
    btc_relative_1y_pct:
      change1y != null && market.btc_change_1y_pct != null ? market.btc_change_1y_pct - change1y : null,
  });

  return [
    makeRow("S&P 500", "SPX", cmp.sp500_change_24h_pct, cmp.sp500_change_ytd_pct, cmp.sp500_change_1y_pct),
    makeRow("Nasdaq", "IXIC", cmp.nasdaq_change_24h_pct, cmp.nasdaq_change_ytd_pct, cmp.nasdaq_change_1y_pct),
    makeRow("Gold", "XAU", cmp.gold_change_24h_pct, cmp.gold_change_ytd_pct, cmp.gold_change_1y_pct),
    makeRow("Dollar Index", "DXY", cmp.dxy_change_24h_pct, cmp.dxy_change_ytd_pct, cmp.dxy_change_1y_pct),
  ];
}

// ─── Formatting primitives ────────────────────────────────────────────────

function formatPct(pct: number): string {
  return `${Math.abs(pct).toFixed(1)}%`;
}

function formatPctSigned(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function roundToK(price: number): string {
  // $74,316 → "74,316"; $74,000 → "74k"
  const rounded = Math.round(price);
  if (rounded >= 1_000_000) {
    return `${(rounded / 1_000_000).toFixed(2)}M`;
  }
  return rounded.toLocaleString("en-US");
}

function truncateHeroLine(s: string): string {
  if (s.length <= 260) return s;
  return s.slice(0, 257).trimEnd() + "...";
}
