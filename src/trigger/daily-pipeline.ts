import { schedules, batch, logger } from "@trigger.dev/sdk/v3";
import { newsCollector } from "./collectors/news";
import { marketCollector } from "./collectors/market";
import { aiBrainTask } from "./processors/ai-brain";
import { enrichmentTask } from "./processors/enrichment";
import { triageTask, perplexityCrossRefTask, mergeTriageWithCrossRef } from "./processors/triage";
import { dayClassifierTask } from "./processors/day-classifier";
import { scrapeArticles } from "./lib/jina";
import { saveBriefingTask } from "./publishers/save-briefing";
import { revalidateSiteTask } from "./publishers/revalidate-site";
import { sendDigestTask } from "./publishers/send-digest";
import { generateAudioBriefTask } from "./audio-brief/generate-audio-brief";
import { computeMarketSignals } from "./processors/market-signals";
import { sendOwnerAlert } from "./lib/alert";
import { computeReadTimeSeconds } from "@/lib/utils";
import type { BriefingJSON, DayClassification } from "@/lib/types";

export const dailyPipelineTask = schedules.task({
  id: "daily-pipeline",
  cron: "0 1 * * *", // 1:00 UTC = 2:00 CET
  run: async () => {
    const date = new Date().toISOString().split("T")[0];
    logger.info("Daily pipeline started", { date });

    try {

    // ── Step 1: Parallel collectors (news + market) ───────────────────────
    const collectorResults = await batch.triggerAndWait<
      typeof newsCollector | typeof marketCollector
    >([
      { id: "news-collector", payload: { date } },
      { id: "market-collector", payload: { date } },
    ]);

    const newsRun = collectorResults.runs.find(
      (r) => r.taskIdentifier === "news-collector"
    );
    const marketRun = collectorResults.runs.find(
      (r) => r.taskIdentifier === "market-collector"
    );

    if (!newsRun?.ok) logger.warn("News collector failed — using empty fallback");
    if (!marketRun?.ok) logger.warn("Market collector failed — using null fallback");

    logger.info("Collectors complete", {
      news: newsRun?.ok ?? false,
      market: marketRun?.ok ?? false,
    });

    const newsOutput = newsRun?.ok ? newsRun.output : { articles: [] };

    // ── Step 1.5: Parallel triage + Perplexity cross-reference ────────────
    let triageRankings: import("@/lib/types").TriageItem[] = [];

    if (newsOutput.articles.length > 0) {
      const [triageResult, crossRefResult] = await Promise.allSettled([
        triageTask.triggerAndWait({ articles: newsOutput.articles }),
        perplexityCrossRefTask.triggerAndWait(),
      ]);

      const triageRun = triageResult.status === "fulfilled" ? triageResult.value : null;
      const crossRefRun = crossRefResult.status === "fulfilled" ? crossRefResult.value : null;

      if (!triageRun?.ok) logger.warn("Triage failed, will fall back to recency-based scraping");
      if (!crossRefRun?.ok) logger.warn("Perplexity cross-ref failed, proceeding without");

      // ── Step 1.7: Merge results + targeted scraping ───────────────────
      const { articlesToScrape, triageRankings: rankings } = mergeTriageWithCrossRef(
        newsOutput.articles,
        triageRun?.ok ? triageRun.output : null,
        crossRefRun?.ok ? crossRefRun.output : null,
      );
      triageRankings = rankings;

      // Scrape full text for importance-ranked articles (not recency-ranked)
      try {
        const scraped = await scrapeArticles(articlesToScrape, 15);
        for (const article of newsOutput.articles) {
          const fullText = scraped.get(article.url);
          if (fullText) article.content = fullText;
        }
        // Also enrich any synthetic articles from cross-ref
        for (const article of articlesToScrape) {
          if (
            !newsOutput.articles.find(
              (a) => a.url.toLowerCase() === article.url.toLowerCase()
            ) &&
            scraped.has(article.url)
          ) {
            article.content = scraped.get(article.url);
            newsOutput.articles.push(article);
          }
        }
        logger.info("Targeted scraping complete", { scraped: scraped.size });
      } catch (e) {
        logger.warn("Jina scraping failed, continuing with headlines only", {
          error: (e as Error).message,
        });
      }
    }

    logger.info("Triage and scraping complete", {
      articleCount: newsOutput.articles.length,
      triageRankCount: triageRankings.length,
      articlesWithContent: newsOutput.articles.filter((a) => a.content).length,
    });

    // ── Step 1.8: Day classifier (non-fatal, precursor signal to AI brain)
    // Lightweight Claude call that labels today as thesis_shift / risk_change /
    // mostly_noise / mixed with historical smoothing. Steers AI brain depth
    // and provides the OPEN calibrating line for the audio brief.
    let dayClassification: DayClassification | null = null;
    try {
      const classifierRun = await dayClassifierTask.triggerAndWait({
        date,
        news: newsOutput,
        market: marketRun?.ok ? marketRun.output : null,
        triageRankings,
      });
      if (classifierRun.ok) {
        dayClassification = classifierRun.output;
      }
      logger.info("Day classifier complete", {
        label: dayClassification?.label ?? "(failed)",
      });
    } catch (err) {
      logger.warn("Day classifier threw, proceeding without classification", {
        error: (err as Error).message,
      });
    }

    // ── Step 2: AI Brain (fatal) ──────────────────────────────────────────
    const briefing = await aiBrainTask
      .triggerAndWait({
        date,
        news: newsOutput,
        market: marketRun?.ok ? marketRun.output : null,
        triageContext: triageRankings.length > 0 ? triageRankings : undefined,
        dayContext: dayClassification ?? undefined,
      })
      .unwrap();

    logger.info("AI Brain complete");

    // ── Step 3: Enrichment (non-fatal) ────────────────────────────────────
    let enrichment: {
      looking_ahead: string;
      institutional_flows: BriefingJSON["institutional_flows"];
      supply_dynamics: BriefingJSON["supply_dynamics"];
      expert_insights: BriefingJSON["expert_insights"];
    } = {
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

    // Build market summary for enrichment context
    const marketOutput = marketRun?.ok ? marketRun.output : null;
    const marketSummary = marketOutput
      ? `Price: $${marketOutput.price.usd.toLocaleString()} | 24h: ${marketOutput.price.change_24h_pct >= 0 ? "+" : ""}${marketOutput.price.change_24h_pct.toFixed(2)}% | 7d: ${marketOutput.price.change_7d_pct >= 0 ? "+" : ""}${marketOutput.price.change_7d_pct.toFixed(2)}% | Dominance: ${marketOutput.dominance_pct.toFixed(1)}% | RSI: ${marketOutput.technical.rsi_14.toFixed(0)} | SMA-50: $${marketOutput.technical.sma_50.toLocaleString()} | SMA-200: $${marketOutput.technical.sma_200.toLocaleString()}`
      : null;

    try {
      const enriched = await enrichmentTask
        .triggerAndWait({
          top_stories: briefing.top_stories,
          all_articles: newsOutput.articles,
          market_summary: marketSummary,
          briefing_summary: {
            one_line: briefing.one_line ?? "",
            macro_narrative: briefing.macro_context?.narrative ?? "",
            technical_summary: briefing.technical_signals?.signal_summary ?? "",
            narrative_label: briefing.narrative_consensus?.label ?? "",
            narrative_score: briefing.narrative_consensus?.score ?? 0,
          },
        })
        .unwrap();
      enrichment = enriched;
      logger.info("Enrichment complete");
    } catch (err) {
      logger.warn("Enrichment failed — using fallback", {
        error: (err as Error).message,
      });
    }

    const finalBriefing: BriefingJSON = {
      ...briefing,
      looking_ahead: enrichment.looking_ahead,
      institutional_flows: enrichment.institutional_flows,
      supply_dynamics: enrichment.supply_dynamics,
      expert_insights: enrichment.expert_insights,
      etf_flows: marketOutput?.etf_flows ?? null,
      funding_rate: marketOutput?.funding_rate ?? null,
      fear_greed: marketOutput?.fear_greed ?? null,
      correlation_matrix: marketOutput?.correlation_matrix ?? null,
      day_classification: dayClassification,
      comparative: marketOutput?.comparative ?? null,
    };

    // ── Step 3.25: Market Signals (non-fatal) ────────────────────────────
    // Trigger-based editorial callouts. Silent on quiet days by design.
    // Runs before audio brief so the script can reference fired signals.
    // Never throws; failure returns [] and ships the brief without signals.
    finalBriefing.market_signals = await computeMarketSignals({
      date,
      funding_rate: finalBriefing.funding_rate,
      fear_greed: finalBriefing.fear_greed,
      correlation_matrix: finalBriefing.correlation_matrix,
    });

    // Compute read time after all fields (including enrichment) are populated.
    // Powers the 3-Minute Contract display on the homepage and email header.
    finalBriefing.read_time_seconds = computeReadTimeSeconds(finalBriefing);
    logger.info("Read time computed", {
      seconds: finalBriefing.read_time_seconds,
      hasHeroLines: Boolean(finalBriefing.hero_three_lines),
      predictionCount: finalBriefing.looking_ahead_predictions?.length ?? 0,
    });

    // ── Step 3.5: Audio Brief (non-fatal) ─────────────────────────────────
    // Pillar 2: generate the 4-minute Pro audio brief. Runs before save so
    // audio_url can be persisted in the same write. Failure is non-fatal:
    // the pipeline continues and the daily digest email ships without a
    // listen button.
    try {
      const audioRun = await generateAudioBriefTask
        .triggerAndWait({ date, briefing: finalBriefing });
      if (audioRun.ok) {
        finalBriefing.audio_url = audioRun.output.audio_url;
        finalBriefing.audio_duration_seconds = audioRun.output.audio_duration_seconds;
        finalBriefing.audio_script = audioRun.output.audio_script;
        logger.info("Audio brief complete", {
          audio_url: finalBriefing.audio_url,
          duration: finalBriefing.audio_duration_seconds,
          scriptWords: finalBriefing.audio_script?.split(/\s+/).filter(Boolean).length ?? 0,
        });
      } else {
        logger.warn("Audio brief task failed — shipping without audio");
      }
    } catch (err) {
      logger.warn("Audio brief threw — shipping without audio", {
        error: (err as Error).message,
      });
    }

    // ── Step 3.9: Health gate (non-blocking) ──────────────────────────────
    // Summarize the brief's completeness and alert the owner when degraded.
    // By design this NEVER blocks the ship — "BTC Today ships every day" is
    // the product contract. The alert just tells you to investigate tomorrow's
    // pipeline, not to halt today's.
    const health = summarizeBriefingHealth(finalBriefing);
    logger.info("Briefing health summary", { ...health });
    if (health.degraded) {
      // Fire and forget — the send helper swallows its own errors.
      await sendOwnerAlert({
        severity: "degraded",
        subject: `Briefing shipping degraded: ${date}`,
        text: `The ${date} briefing is about to ship, but one or more pipeline components came back empty or defaulted. The brief will still deliver (product contract: ship every day), but you may want to investigate before tomorrow's run.\n\nHealth summary:\n${JSON.stringify(health, null, 2)}\n\nCheck Trigger.dev dashboard logs for details.`,
      });
    }

    // ── Step 4: Publish (sequential) ──────────────────────────────────────
    await saveBriefingTask.triggerAndWait({ date, briefing: finalBriefing }).unwrap();
    logger.info("Briefing saved to Supabase");

    const revalResult = await revalidateSiteTask.triggerAndWait();
    if (revalResult.ok && revalResult.output.revalidated) {
      logger.info("Site revalidated");
    } else {
      logger.warn("Site revalidation failed (non-fatal, cached content may be stale)");
    }

    await sendDigestTask.triggerAndWait({ date, briefing: finalBriefing }).unwrap();
    logger.info("Email digest sent");

    logger.info("Daily pipeline complete", { date });
    return { status: "success", date };

    } catch (error) {
      logger.error("PIPELINE FAILED", { date, error: (error as Error).message });

      await sendOwnerAlert({
        severity: "critical",
        subject: `Daily pipeline failed: ${date}`,
        text: `The daily pipeline for ${date} failed.\n\nError: ${(error as Error).message}\n\nStack: ${(error as Error).stack}\n\nCheck Trigger.dev dashboard for details.`,
      });

      throw error; // Re-throw so Trigger.dev marks the run as failed
    }
  },
});

// ─── Health gate ─────────────────────────────────────────────────────────

interface BriefingHealth {
  storyCount: number;
  hasMarket: boolean;
  hasHeroLines: boolean;
  hasAudio: boolean;
  hasExperts: boolean;
  hasFlows: boolean;
  hasLookingAhead: boolean;
  fallbackUsed: boolean;
  degraded: boolean;
  degradedReasons: string[];
}

/**
 * Compute a compact health summary of the final briefing. We alert (not
 * block) the owner whenever 2+ signals are degraded, when the AI Brain
 * fallback fired, or when the brief has zero stories. The brief still
 * ships — this is ops telemetry, not a gate.
 *
 * Thresholds chosen conservatively so we don't page on a normal quiet day.
 * A normal quiet day might have 0 stories and still be complete if
 * adoption + regulatory pick up the slack.
 */
function summarizeBriefingHealth(briefing: BriefingJSON): BriefingHealth {
  const storyCount =
    briefing.top_stories.length + briefing.regulatory.length + briefing.adoption.length;
  const hasMarket = Number(briefing.market_snapshot?.price_usd) > 0;
  const hasHeroLines = Boolean(briefing.hero_three_lines?.move);
  const hasAudio = Boolean(briefing.audio_url);
  const hasExperts = (briefing.expert_insights?.length ?? 0) > 0;
  const flowsSummary = briefing.institutional_flows?.summary;
  const flowsMoves = briefing.institutional_flows?.notable_moves ?? [];
  const hasFlows = flowsMoves.length > 0 || (!!flowsSummary && flowsSummary !== "Data unavailable");
  const hasLookingAhead =
    !!briefing.looking_ahead &&
    !briefing.looking_ahead.toLowerCase().includes("unavailable");
  const fallbackUsed = Boolean(briefing.fallback_used);

  const degradedReasons: string[] = [];
  if (fallbackUsed) degradedReasons.push("AI Brain fallback fired (both Anthropic and Kie.ai exhausted)");
  if (storyCount === 0) degradedReasons.push("Zero stories across top_stories + regulatory + adoption");
  if (!hasHeroLines) degradedReasons.push("No hero_three_lines (3-Minute Contract hero missing)");
  if (!hasMarket) degradedReasons.push("No market_snapshot price (collector failed)");
  if (!hasAudio) degradedReasons.push("No audio_url (audio brief failed)");
  if (!hasExperts) degradedReasons.push("No expert_insights (Perplexity failed or returned empty)");

  // Alert if either the fallback fired, or 2+ independent signals are degraded.
  // A single non-fatal failure on a normal day (e.g. audio flake) doesn't page.
  const degraded = fallbackUsed || degradedReasons.length >= 2;

  return {
    storyCount,
    hasMarket,
    hasHeroLines,
    hasAudio,
    hasExperts,
    hasFlows,
    hasLookingAhead,
    fallbackUsed,
    degraded,
    degradedReasons,
  };
}
