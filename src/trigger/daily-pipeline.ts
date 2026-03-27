import { schedules, batch, logger } from "@trigger.dev/sdk/v3";
import { newsCollector } from "./collectors/news";
import { marketCollector } from "./collectors/market";
import { aiBrainTask } from "./processors/ai-brain";
import { enrichmentTask } from "./processors/enrichment";
import { saveBriefingTask } from "./publishers/save-briefing";
import { revalidateSiteTask } from "./publishers/revalidate-site";
import { sendDigestTask } from "./publishers/send-digest";
import type { BriefingJSON } from "@/lib/types";

export const dailyPipelineTask = schedules.task({
  id: "daily-pipeline",
  cron: "0 1 * * *", // 1:00 UTC = 2:00 CET
  run: async () => {
    const date = new Date().toISOString().split("T")[0];
    logger.info("Daily pipeline started", { date });

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

    // ── Step 2: AI Brain (fatal) ──────────────────────────────────────────
    const briefing = await aiBrainTask
      .triggerAndWait({
        date,
        news: newsRun?.ok ? newsRun.output : { articles: [] },
        market: marketRun?.ok ? marketRun.output : null,
      })
      .unwrap();

    logger.info("AI Brain complete");

    // ── Step 3: Enrichment (non-fatal) ────────────────────────────────────
    let enrichment = {
      looking_ahead: "Forward-looking analysis unavailable today.",
      institutional_flows: {
        etf_net_flow_usd: null as number | null,
        etf_total_aum_usd: null as number | null,
        etf_flow_trend: "Data unavailable",
        notable_moves: [] as string[],
      },
      supply_dynamics: {
        exchange_reserve_trend: "Data unavailable",
        long_term_holder_pct: null as number | null,
        supply_narrative: "Supply data unavailable today.",
      },
      expert_insights: [] as BriefingJSON["expert_insights"],
    };

    try {
      const enriched = await enrichmentTask
        .triggerAndWait({
          top_stories: briefing.top_stories.slice(0, 3),
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
      fear_greed: marketRun?.ok ? marketRun.output.fear_greed : null,
    };

    // ── Step 4: Publish (sequential) ──────────────────────────────────────
    await saveBriefingTask.triggerAndWait({ date, briefing: finalBriefing }).unwrap();
    logger.info("Briefing saved to Supabase");

    await revalidateSiteTask.triggerAndWait().unwrap();
    logger.info("Site revalidated");

    await sendDigestTask.triggerAndWait({ date, briefing: finalBriefing }).unwrap();
    logger.info("Email digest sent");

    logger.info("Daily pipeline complete", { date });
    return { status: "success", date };
  },
});
