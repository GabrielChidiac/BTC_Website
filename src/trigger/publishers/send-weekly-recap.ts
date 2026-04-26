import { schedules, logger } from "@trigger.dev/sdk/v3";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow, WeeklyRecapData, DaySummary } from "@/lib/types";
import { formatUSD, formatPctChange } from "@/lib/utils";
import { EMAIL_BATCH_SIZE, FROM_ADDRESS } from "@/lib/constants";
import WeeklyRecap from "../../../emails/weekly-recap";
import { getBaseUrl } from "@/lib/url";

// ─── Data aggregation ─────────────────────────────────────────────────────────

function buildRecapData(rows: DailyBriefingRow[]): WeeklyRecapData {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].content;
  const last = sorted[sorted.length - 1].content;

  // Daily summaries
  const dailySummaries: DaySummary[] = sorted.map((row) => {
    const b = row.content;
    return {
      date: row.date,
      price_usd: b.market_snapshot.price_usd,
      change_24h_pct: b.market_snapshot.change_24h_pct,
      consensus_label: b.narrative_consensus?.label ?? "N/A",
      consensus_score: b.narrative_consensus?.score ?? 0,
      one_line: b.one_line ?? null,
    };
  });

  // Price stats
  const prices = dailySummaries.map((d) => d.price_usd);
  const priceStart = first.market_snapshot.price_usd;
  const priceEnd = last.market_snapshot.price_usd;

  // Top stories: first story from each day, deduplicate, cap at 5
  const seen = new Set<string>();
  const topStories: WeeklyRecapData["top_stories"] = [];
  for (const row of sorted) {
    const dayStory = row.content.top_stories[0];
    if (!dayStory) continue;
    const key = dayStory.headline.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    topStories.push({
      headline: dayStory.headline,
      source: dayStory.source,
      url: dayStory.url,
      summary: dayStory.summary,
      sentiment: dayStory.sentiment,
      date: row.date,
    });
    if (topStories.length >= 5) break;
  }

  // BTC vs Everything from latest day
  const btcVs = (last.btc_vs_everything ?? []).map((c) => ({
    name: c.name,
    ticker: c.ticker,
    change_ytd_pct: c.change_ytd_pct,
  }));

  // Volume average
  const volumes = sorted.map((r) => r.content.market_snapshot.volume_24h_usd);
  const volumeAvg = volumes.reduce((a, b) => a + b, 0) / volumes.length;

  return {
    week_start: sorted[0].date,
    week_end: sorted[sorted.length - 1].date,
    days_available: sorted.length,
    price_start: priceStart,
    price_end: priceEnd,
    price_change_pct: ((priceEnd - priceStart) / priceStart) * 100,
    price_high: Math.max(...prices),
    price_low: Math.min(...prices),
    btc_7d_change_pct: ((priceEnd - priceStart) / priceStart) * 100,
    daily_summaries: dailySummaries,
    top_stories: topStories,
    regulatory_highlights: [],
    adoption_highlights: [],
    btc_vs_everything: btcVs,
    market_cap_end: last.market_snapshot.market_cap_usd,
    volume_avg: volumeAvg,
    dominance_end: last.market_snapshot.dominance_pct,
  };
}

// ─── Scheduled task ───────────────────────────────────────────────────────────

export const sendWeeklyRecapTask = schedules.task({
  id: "weekly-recap",
  cron: "0 9 * * 0", // 9 UTC = 10 CET, every Sunday
  run: async (): Promise<{ sent: number; failed: number }> => {
    // Step 1: Check Resend key
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      logger.warn("RESEND_API_KEY not set — skipping weekly recap");
      return { sent: 0, failed: 0 };
    }

    // Step 2: Fetch last 7 days of briefings
    const supabase = createServiceClient();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = yesterday.toISOString().split("T")[0]; // Saturday
    const startDate = new Date(yesterday.getTime() - 6 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0]; // Previous Sunday

    const { data: rows, error: briefingError } = await supabase
      .from("daily_briefings")
      .select("date, content")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (briefingError) {
      logger.error("Failed to fetch briefings for recap", { error: briefingError.message });
      throw new Error(`[weekly-recap] Supabase query failed: ${briefingError.message}`);
    }

    const briefings = (rows ?? []) as DailyBriefingRow[];

    if (briefings.length === 0) {
      logger.warn("No briefings found for the past 7 days — skipping recap");
      return { sent: 0, failed: 0 };
    }

    logger.info("Building weekly recap", { days: briefings.length, startDate, endDate });

    // Step 3: Aggregate into recap data
    const recap = buildRecapData(briefings);

    // Step 4: Fetch active free subscribers
    const { data: subscribers, error: subError } = await supabase
      .from("subscribers")
      .select("email, name, tier")
      .eq("status", "active")
      .eq("tier", "free");

    if (subError) {
      logger.error("Failed to fetch free subscribers", { error: subError.message });
      throw new Error(`[weekly-recap] Subscriber query failed: ${subError.message}`);
    }

    const activeEmails = (subscribers ?? []).map((s) => s.email);
    const nameByEmail = new Map((subscribers ?? []).map((s) => [s.email, s.name as string | null]));

    if (activeEmails.length === 0) {
      logger.info("No active free subscribers — skipping weekly recap");
      return { sent: 0, failed: 0 };
    }

    logger.info("Sending weekly recap to free subscribers", {
      subscriberCount: activeEmails.length,
      weekStart: recap.week_start,
      weekEnd: recap.week_end,
    });

    // Step 5: Render email template
    const siteUrl = getBaseUrl();
    const htmlTemplate = await render(WeeklyRecap({ recap, siteUrl, name: "%%NAME%%" }));

    const subject = `Your Week in Bitcoin: ${formatUSD(recap.price_end, 0)} (${formatPctChange(recap.price_change_pct)})`;

    // Plain text fallback
    const storySummaries = recap.top_stories
      .map((s, i) => `${i + 1}. ${s.headline} (${s.source})\n   ${s.summary}`)
      .join("\n\n");

    const textTemplate = `BTC Today | Week in Review (${recap.week_start} to ${recap.week_end})

Price: ${formatUSD(recap.price_end, 0)} | Week: ${formatPctChange(recap.price_change_pct)} | High: ${formatUSD(recap.price_high, 0)} | Low: ${formatUSD(recap.price_low, 0)}

Top Stories:

${storySummaries || "No major stories this week."}

Read the latest briefing: %%BRIEFING_URL%%

Want the full picture? Go Pro for the daily email, PDF downloads, and full archive:
${siteUrl}/pricing

Tip in sats: ${siteUrl}/tip?source=newsletter or send to btctoday@coinos.io

Unsubscribe: %%UNSUBSCRIBE_URL%%

- BTC Today`;

    // Step 6: Generate magic link tokens
    const authTokens = new Map<string, string>();
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    for (const email of activeEmails) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      authTokens.set(email, Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""));
    }

    const tokenRows = activeEmails.map((email) => ({
      email,
      code: `magic:${authTokens.get(email)}`,
      expires_at: tokenExpiry.toISOString(),
    }));

    const { error: tokenError } = await supabase
      .from("verification_codes")
      .insert(tokenRows);

    if (tokenError) {
      logger.warn("Failed to create auth tokens — emails will send without auto-login links", {
        error: tokenError.message,
      });
    }

    // Step 7: Send in batches via Resend
    const resend = new Resend(resendKey);
    const latestDate = recap.week_end;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < activeEmails.length; i += EMAIL_BATCH_SIZE) {
      const batch = activeEmails.slice(i, i + EMAIL_BATCH_SIZE);

      const batchPayload = batch.map((email) => {
        const token = authTokens.get(email);
        const subscriberName = nameByEmail.get(email);

        // Build auth-carrying briefing URL
        const briefingUrl = token
          ? `${siteUrl}/sign-in?token=${token}&email=${encodeURIComponent(email)}`
          : `${siteUrl}/archive/${latestDate}`;

        const unsubscribeUrl = token
          ? `${siteUrl}/sign-in?token=${token}&email=${encodeURIComponent(email)}`
          : `${siteUrl}/sign-in`;

        let html = htmlTemplate
          .replace(/%%BRIEFING_URL%%/g, briefingUrl)
          .replace(/%%UNSUBSCRIBE_URL%%/g, unsubscribeUrl);
        let text = textTemplate
          .replace(/%%BRIEFING_URL%%/g, briefingUrl)
          .replace(/%%UNSUBSCRIBE_URL%%/g, unsubscribeUrl);

        if (subscriberName) {
          html = html.replace(/%%NAME%%/g, subscriberName);
          text = `Hi ${subscriberName},\n\n${text}`;
        } else {
          html = html.replace(/Good morning, %%NAME%%\./g, "Good morning.");
          text = text.replace(/%%NAME%%/g, "");
        }

        return {
          from: FROM_ADDRESS,
          to: email,
          subject,
          html,
          text,
        };
      });

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

    logger.info("Weekly recap send complete", { sent: totalSent, failed: totalFailed });
    return { sent: totalSent, failed: totalFailed };
  },
});
