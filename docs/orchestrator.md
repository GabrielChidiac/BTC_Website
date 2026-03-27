# Orchestrator — daily-pipeline.ts Reference

```typescript
import { schedules, batch } from "@trigger.dev/sdk/v3";

export const dailyPipelineTask = schedules.task({
  id: "daily-pipeline",
  cron: "0 1 * * *", // 1:00 UTC = 2:00 CET
  run: async () => {
    const date = new Date().toISOString().split("T")[0];

    // PARALLEL: 3 collectors via batch.triggerAndWait
    const collectorResults = await batch.triggerAndWait<
      typeof newsCollectorTask | typeof youtubeCollectorTask | typeof marketCollectorTask
    >([
      { id: "news-collector", payload: { date } },
      { id: "youtube-collector", payload: { date } },
      { id: "market-collector", payload: { date } },
    ]);

    const newsRun = collectorResults.runs.find(r => r.taskIdentifier === "news-collector");
    const youtubeRun = collectorResults.runs.find(r => r.taskIdentifier === "youtube-collector");
    const marketRun = collectorResults.runs.find(r => r.taskIdentifier === "market-collector");

    // SEQUENTIAL: AI processing (needs all collector data)
    const briefing = await aiBrainTask.triggerAndWait({
      date,
      news: newsRun?.ok ? newsRun.output : { articles: [] },
      youtube: youtubeRun?.ok ? youtubeRun.output : { transcripts: [] },
      market: marketRun?.ok ? marketRun.output : null,
    }).unwrap();

    // SEQUENTIAL: Enrichment (non-fatal)
    let lookingAhead = "Forward-looking analysis unavailable today.";
    try {
      const enriched = await enrichmentTask.triggerAndWait({
        top_stories: briefing.top_stories.slice(0, 3),
      }).unwrap();
      lookingAhead = enriched.looking_ahead;
    } catch { /* non-fatal */ }

    const finalBriefing = { ...briefing, looking_ahead: lookingAhead };

    // PUBLISH: sequential (save must succeed before revalidate/email)
    await saveBriefingTask.triggerAndWait({ date, briefing: finalBriefing }).unwrap();
    await revalidateSiteTask.triggerAndWait({}).unwrap();
    await sendDigestTask.triggerAndWait({ date, briefing: finalBriefing }).unwrap();

    return { status: "success", date };
  },
});
```

## Key Rules
- Use `batch.triggerAndWait()` for parallel sub-tasks — NOT `Promise.all()` with individual `triggerAndWait`
- Collectors run in parallel; everything after is sequential
- Enrichment failure is non-fatal — briefing still publishes
- Save must complete before revalidate and email
