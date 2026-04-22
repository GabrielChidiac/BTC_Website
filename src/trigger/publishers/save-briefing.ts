import { task, logger } from "@trigger.dev/sdk/v3";
import { createServiceClient } from "@/lib/supabase/server";
import type { BriefingJSON } from "@/lib/types";

interface SaveBriefingPayload {
  date: string; // "YYYY-MM-DD"
  briefing: BriefingJSON;
}

export const saveBriefingTask = task({
  id: "save-briefing",
  run: async (payload: SaveBriefingPayload): Promise<{ saved: true }> => {
    const { date, briefing } = payload;

    logger.info("Saving briefing to Supabase", { date });

    const supabase = createServiceClient();

    // Upsert: insert or update on date conflict
    const { error } = await supabase
      .from("daily_briefings")
      .upsert(
        { date, content: briefing },
        { onConflict: "date" }
      );

    if (error) {
      logger.error("Failed to save briefing", { error: error.message });
      throw new Error(`[save-briefing] Supabase upsert failed: ${error.message}`);
    }

    logger.info("Briefing saved successfully", { date });

    // ─── Silent prediction data collection (non-fatal) ───────────────────
    // The AI brain generates 2-3 looking_ahead_predictions per briefing. These
    // feed a future accuracy scorecard launching at day 60. Failures here must
    // never break the main save path (the table may not exist yet in every
    // environment, or the AI output may be malformed).
    const predictions = briefing.looking_ahead_predictions ?? [];
    if (predictions.length > 0) {
      const rows = predictions.map((p) => ({
        briefing_date: date,
        claim_text: p.claim_text,
        direction: p.direction,
        metric: p.metric,
        target_date: p.target_date,
      }));

      // Two attempts with 500ms backoff. The day-60 accuracy scorecard
      // depends on a complete history; a silent miss today would bias the
      // scorecard permanently. We still don't throw — briefing save must
      // succeed — but on final failure we log ERROR with the payload so the
      // row is manually recoverable from the Trigger dashboard.
      const MAX_ATTEMPTS = 2;
      let inserted = false;
      let lastError: string = "unknown";

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const { error: predictionError } = await supabase
            .from("predictions")
            .insert(rows);

          if (!predictionError) {
            inserted = true;
            logger.info("Predictions recorded", { count: rows.length, attempt });
            break;
          }

          lastError = predictionError.message;
          if (attempt < MAX_ATTEMPTS) {
            logger.warn("Predictions insert failed — retrying", {
              attempt,
              error: lastError,
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (e) {
          lastError = (e as Error).message;
          if (attempt < MAX_ATTEMPTS) {
            logger.warn("Predictions insert threw — retrying", {
              attempt,
              error: lastError,
            });
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        }
      }

      if (!inserted) {
        // ERROR (not warn): the scorecard series has a gap for this date.
        // Log the full payload so it can be manually backfilled if needed.
        logger.error("Predictions insert failed after retries — scorecard will have a gap for this date", {
          date,
          count: rows.length,
          error: lastError,
          rows: rows.slice(0, 5),
        });
      }
    }

    return { saved: true };
  },
});
