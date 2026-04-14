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
      try {
        const rows = predictions.map((p) => ({
          briefing_date: date,
          claim_text: p.claim_text,
          direction: p.direction,
          metric: p.metric,
          target_date: p.target_date,
        }));

        const { error: predictionError } = await supabase
          .from("predictions")
          .insert(rows);

        if (predictionError) {
          logger.warn("Failed to insert predictions (non-fatal)", {
            error: predictionError.message,
            count: rows.length,
          });
        } else {
          logger.info("Predictions recorded", { count: rows.length });
        }
      } catch (e) {
        logger.warn("Predictions insert threw (non-fatal)", {
          error: (e as Error).message,
        });
      }
    }

    return { saved: true };
  },
});
