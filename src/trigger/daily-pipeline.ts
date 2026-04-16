import { schedules, batch, logger } from "@trigger.dev/sdk/v3";
import { newsCollector } from "./collectors/news";
import { marketCollector } from "./collectors/market";
import { aiBrainTask } from "./processors/ai-brain";
import { enrichmentTask } from "./processors/enrichment";
import { triageTask, perplexityCrossRefTask, mergeTriageWithCrossRef } from "./processors/triage";
import { scrapeArticles } from "./lib/jina";
import { saveBriefingTask } from "./publishers/save-briefing";
import { revalidateSiteTask } from "./publishers/revalidate-site";
import { sendDigestTask } from "./publishers/send-digest";
import { generateAudioBriefTask } from "./audio-brief/generate-audio-brief";
import { computeReadTimeSeconds } from "@/lib/utils";
import type { BriefingJSON } from "@/lib/types";

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

    // ── Step 2: AI Brain (fatal) ──────────────────────────────────────────
    const briefing = await aiBrainTask
      .triggerAndWait({
        date,
        news: newsOutput,
        market: marketRun?.ok ? marketRun.output : null,
        triageContext: triageRankings.length > 0 ? triageRankings : undefined,
      })
      .unwrap();

    logger.info("AI Brain complete");

    // ── Step 3: Enrichment (non-fatal) ────────────────────────────────────
    let enrichment = {
      looking_ahead: "Forward-looking analysis unavailable today.",
      institutional_flows: {
        summary: "Data unavailable",
        notable_moves: [] as string[],
      },
      supply_dynamics: {
        exchange_reserve_trend: "Data unavailable",
        long_term_holder_pct: null as number | null,
        supply_narrative: "Supply data unavailable today.",
      },
      expert_insights: [] as BriefingJSON["expert_insights"],
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
    };

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

      // Send alert email so the owner knows immediately
      try {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey) {
          const { Resend } = await import("resend");
          const resend = new Resend(resendKey);
          await resend.emails.send({
            from: "BTC Today Alerts <hello@btctoday.co>",
            to: "hello@btctoday.co",
            subject: `[ALERT] Daily pipeline failed: ${date}`,
            text: `The daily pipeline for ${date} failed.\n\nError: ${(error as Error).message}\n\nStack: ${(error as Error).stack}\n\nCheck Trigger.dev dashboard for details.`,
          });
        }
      } catch { /* alert send failed — nothing we can do */ }

      throw error; // Re-throw so Trigger.dev marks the run as failed
    }
  },
});
