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
    return { saved: true };
  },
});
