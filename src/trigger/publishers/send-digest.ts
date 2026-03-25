import { task, logger } from "@trigger.dev/sdk/v3";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { BriefingJSON } from "@/lib/types";
import DailyDigest from "../../../emails/daily-digest";

interface SendDigestPayload {
  date: string; // "YYYY-MM-DD"
  briefing: BriefingJSON;
}

const BATCH_SIZE = 100; // Resend batch limit per call
const FROM_ADDRESS = "BTC Today <digest@btctoday.dev>";

export const sendDigestTask = task({
  id: "send-digest",
  run: async (payload: SendDigestPayload): Promise<{ sent: number; failed: number }> => {
    const { date, briefing } = payload;

    // Step 1: Check Resend key
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      logger.warn("RESEND_API_KEY not set — skipping email digest");
      return { sent: 0, failed: 0 };
    }

    // Step 2: Fetch active subscribers
    const supabase = createServiceClient();
    const { data: subscribers, error } = await supabase
      .from("subscribers")
      .select("email")
      .eq("status", "active");

    if (error) {
      logger.error("Failed to fetch subscribers", { error: error.message });
      throw new Error(`[send-digest] Supabase query failed: ${error.message}`);
    }

    const activeEmails = subscribers.map((s) => s.email);

    if (activeEmails.length === 0) {
      logger.info("No active subscribers — skipping email digest");
      return { sent: 0, failed: 0 };
    }

    logger.info("Sending digest", { subscriberCount: activeEmails.length, date });

    // Step 3: Build email content
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { market_snapshot, top_stories } = briefing;

    const subject = `BTC Today — $${market_snapshot.price_usd.toLocaleString("en-US")} (${market_snapshot.change_24h_pct >= 0 ? "+" : ""}${market_snapshot.change_24h_pct.toFixed(2)}%)`;

    // Render React Email template to HTML
    const htmlBody = await render(DailyDigest({ briefing, siteUrl }));

    // Plain text fallback for clients that don't render HTML
    const storySummaries = top_stories
      .slice(0, 3)
      .map((s, i) => `${i + 1}. ${s.headline} (${s.source})\n   ${s.summary}`)
      .join("\n\n");

    const textBody = `BTC Today — ${date}

Market: $${market_snapshot.price_usd.toLocaleString("en-US")} | 24h: ${market_snapshot.change_24h_pct >= 0 ? "+" : ""}${market_snapshot.change_24h_pct.toFixed(2)}% | 7d: ${market_snapshot.change_7d_pct >= 0 ? "+" : ""}${market_snapshot.change_7d_pct.toFixed(2)}%

Top Stories:

${storySummaries || "No stories today."}

Read the full briefing: ${siteUrl}/archive/${date}

— BTC Today`;

    // Step 4: Send in batches via Resend
    const resend = new Resend(resendKey);
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < activeEmails.length; i += BATCH_SIZE) {
      const batch = activeEmails.slice(i, i + BATCH_SIZE);

      const batchPayload = batch.map((email) => ({
        from: FROM_ADDRESS,
        to: email,
        subject,
        html: htmlBody,
        text: textBody,
      }));

      try {
        const result = await resend.batch.send(batchPayload);

        if (result.error) {
          logger.error("Batch send error", {
            batchIndex: i,
            error: result.error.message,
          });
          totalFailed += batch.length;
        } else {
          totalSent += batch.length;
        }
      } catch (err) {
        logger.error("Batch send threw", {
          batchIndex: i,
          error: (err as Error).message,
        });
        totalFailed += batch.length;
      }
    }

    logger.info("Digest send complete", { sent: totalSent, failed: totalFailed });
    return { sent: totalSent, failed: totalFailed };
  },
});
