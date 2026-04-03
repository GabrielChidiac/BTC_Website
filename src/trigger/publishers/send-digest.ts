import { task, logger } from "@trigger.dev/sdk/v3";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabase/server";
import type { BriefingJSON } from "@/lib/types";
import DailyDigest from "../../../emails/daily-digest";
import { DailySummaryPDF } from "../../../emails/daily-summary-pdf";
import { renderToBuffer } from "@react-pdf/renderer";
import { getBaseUrl } from "@/lib/url";

interface SendDigestPayload {
  date: string; // "YYYY-MM-DD"
  briefing: BriefingJSON;
}

const BATCH_SIZE = 100; // Resend batch limit per call
const FROM_ADDRESS = "BTC Today <hello@btctoday.co>";

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

    // Step 2: Fetch active Pro subscribers (only Pro tier receives the daily email)
    const supabase = createServiceClient();
    const { data: subscribers, error } = await supabase
      .from("subscribers")
      .select("email, name, tier")
      .eq("status", "active")
      .eq("tier", "pro");

    if (error) {
      logger.error("Failed to fetch subscribers", { error: error.message });
      throw new Error(`[send-digest] Supabase query failed: ${error.message}`);
    }

    const activeEmails = subscribers.map((s) => s.email);
    const nameByEmail = new Map(subscribers.map((s) => [s.email, s.name as string | null]));

    if (activeEmails.length === 0) {
      logger.info("No active Pro subscribers — skipping email digest");
      return { sent: 0, failed: 0 };
    }

    logger.info("Sending digest to Pro subscribers", { subscriberCount: activeEmails.length, date });

    // Step 3: Build email content
    const siteUrl = getBaseUrl();
    const {
      market_snapshot, top_stories, daily_diff, technical_signals,
      network_health, institutional_flows, supply_dynamics, expert_insights,
      macro_context, looking_ahead, btc_vs_everything, regulatory, adoption,
      fear_greed, narrative_consensus, etf_flows,
    } = briefing;

    const subject = `BTC Today: $${market_snapshot.price_usd.toLocaleString("en-US")} (${market_snapshot.change_24h_pct >= 0 ? "+" : ""}${market_snapshot.change_24h_pct.toFixed(2)}%)`;

    // Render React Email template (all recipients are Pro — full content)
    const htmlTemplate = await render(DailyDigest({ briefing, siteUrl, name: "%%NAME%%" }));

    // Generate PDF summary and upload to Supabase Storage (non-fatal)
    let pdfUrl = "";
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfBuffer = await renderToBuffer(DailySummaryPDF({ briefing }) as any);
      const pdfFilename = `btc-today-${date}.pdf`;

      // Upload to Supabase Storage (briefing-pdfs bucket)
      const { error: uploadError } = await supabase.storage
        .from("briefing-pdfs")
        .upload(pdfFilename, pdfBuffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        logger.warn("PDF upload failed", { error: uploadError.message });
      } else {
        pdfUrl = `${siteUrl}/pdf/${date}`;
        logger.info("PDF generated and uploaded", { pdfUrl });
      }
    } catch (pdfErr) {
      logger.warn("PDF generation failed — emails will send without PDF link", {
        error: (pdfErr as Error).message,
      });
    }

    // Plain text fallback — full Pro content
    const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
    const compact = (n: number) => {
      if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
      if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
      if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
      return n.toLocaleString("en-US");
    };
    const fmtFlow = (n: number) => `${n >= 0 ? "+" : "-"}$${compact(Math.abs(n))}`;

    const sections: string[] = [];

    sections.push(`BTC Today — ${date}`);
    if (briefing.one_line) sections.push(briefing.one_line);

    sections.push(
      `${daily_diff.price_change}\n` +
      `Market: $${market_snapshot.price_usd.toLocaleString("en-US")} | 24h: ${fmtPct(market_snapshot.change_24h_pct)} | 7d: ${fmtPct(market_snapshot.change_7d_pct)}\n` +
      `Mkt Cap: $${compact(market_snapshot.market_cap_usd)} | Vol: $${compact(market_snapshot.volume_24h_usd)} | Dom: ${market_snapshot.dominance_pct.toFixed(1)}%` +
      (fear_greed ? `\nF&G: ${fear_greed.value} (${fear_greed.label})` : "") +
      `\nConsensus: ${narrative_consensus.score > 0 ? "+" : ""}${narrative_consensus.score} (${narrative_consensus.label})`
    );

    // Flows
    const flowLines: string[] = [];
    if (etf_flows?.daily_net_flow_usd != null) flowLines.push(`24h Flow: ${fmtFlow(etf_flows.daily_net_flow_usd)}`);
    if (etf_flows?.mtd_net_flow_usd != null) flowLines.push(`MTD Flow: ${fmtFlow(etf_flows.mtd_net_flow_usd)}`);
    if (etf_flows?.total_net_assets_usd != null) flowLines.push(`ETF AUM: $${compact(etf_flows.total_net_assets_usd)}`);
    if (institutional_flows?.etf_flow_trend && !institutional_flows.etf_flow_trend.toLowerCase().includes("unavailable")) {
      flowLines.push(institutional_flows.etf_flow_trend);
    }
    if (institutional_flows?.notable_moves?.length) {
      flowLines.push(...institutional_flows.notable_moves.map((m) => `• ${m}`));
    }
    if (flowLines.length > 0) sections.push(`--- FLOWS ---\n${flowLines.join("\n")}`);

    // Stories
    const storyLines = top_stories.slice(0, 3).map((s, i) => `${i + 1}. ${s.headline} (${s.source})`).join("\n");
    if (storyLines) sections.push(`--- STORIES ---\n${storyLines}`);

    // Technicals
    sections.push(
      `--- TECHNICALS ---\n` +
      `RSI: ${technical_signals.rsi_14.toFixed(1)} | SMA-50: $${Math.round(technical_signals.sma_50).toLocaleString()} | SMA-200: $${Math.round(technical_signals.sma_200).toLocaleString()}\n` +
      `Support: $${Math.round(technical_signals.support_level).toLocaleString()} | Resistance: $${Math.round(technical_signals.resistance_level).toLocaleString()}`
    );

    // On-chain
    const chainLines = [
      `Hashrate: ${Math.round(network_health.hashrate_eh_s)} EH/s | Halving: ${network_health.halving_progress_pct.toFixed(1)}% | Fees: ${network_health.fee_fast_sat_vb}/${network_health.fee_medium_sat_vb}/${network_health.fee_slow_sat_vb}`,
    ];
    if (supply_dynamics?.supply_narrative && !supply_dynamics.supply_narrative.toLowerCase().includes("unavailable")) {
      chainLines.push(supply_dynamics.long_term_holder_pct != null ? `${supply_dynamics.long_term_holder_pct}% LTH` : "");
    }
    sections.push(`--- ON-CHAIN ---\n${chainLines.filter(Boolean).join("\n")}`);

    // Expert
    if (expert_insights?.length > 0) {
      const e = expert_insights[0];
      sections.push(`--- EXPERT ---\n"${e.quote_or_summary.slice(0, 120)}" — ${e.expert_name}, ${e.role}`);
    }

    // Outlook
    const outlookLines: string[] = [];
    if (macro_context?.narrative) outlookLines.push(macro_context.narrative.split(/\.\s/)[0] + ".");
    if (macro_context?.btc_correlation_note) outlookLines.push(macro_context.btc_correlation_note.split(/\.\s/)[0] + ".");
    if (macro_context?.key_macro_events?.length) outlookLines.push(macro_context.key_macro_events.join(" · "));
    if (looking_ahead && !looking_ahead.toLowerCase().includes("unavailable")) outlookLines.push(looking_ahead.split(/\.\s/)[0] + ".");
    if (outlookLines.length > 0) sections.push(`--- OUTLOOK ---\n${outlookLines.join("\n")}`);

    // VS Everything
    if (btc_vs_everything?.length > 0) {
      const vs = btc_vs_everything.slice(0, 3).map((a) => `${a.ticker} YTD: ${a.change_ytd_pct != null ? fmtPct(a.change_ytd_pct) : "N/A"}`).join(" | ");
      sections.push(`--- VS EVERYTHING ---\nBTC 24h: ${fmtPct(market_snapshot.change_24h_pct)} | ${vs}`);
    }

    // Signals
    const sigLines: string[] = [];
    if (regulatory?.length) sigLines.push(`${regulatory[0].region}: ${regulatory[0].summary.split(/\.\s/)[0]}.`);
    if (adoption?.length) sigLines.push(`${adoption[0].category}: ${adoption[0].summary.split(/\.\s/)[0]}.`);
    if (sigLines.length > 0) sections.push(`--- SIGNALS ---\n${sigLines.join("\n")}`);

    sections.push(`Read full briefing: %%BRIEFING_URL%%\nDownload PDF: %%PDF_URL%%\nChat with AI: %%CHAT_URL%%\nUnsubscribe: %%UNSUBSCRIBE_URL%%\n\n— BTC Today`);

    const textTemplate = sections.join("\n\n");

    // Step 3.5: Generate per-subscriber magic link tokens (all subscribers for auto-login)
    const authTokens = new Map<string, string>();
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    for (const email of activeEmails) {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      authTokens.set(email, Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join(""));
    }

    // Batch insert all magic link tokens
    const tokenRows = activeEmails.map((email) => ({
      email,
      code: `magic:${authTokens.get(email)}`,
      expires_at: tokenExpiry.toISOString(),
    }));

    const { error: tokenError } = await supabase
      .from("verification_codes")
      .insert(tokenRows);

    if (tokenError) {
      logger.warn("Failed to create chat tokens — emails will send without chat links", {
        error: tokenError.message,
      });
    }

    // Step 4: Send in batches via Resend
    const resend = new Resend(resendKey);
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < activeEmails.length; i += BATCH_SIZE) {
      const batch = activeEmails.slice(i, i + BATCH_SIZE);

      const batchPayload = batch.map((email) => {
        const token = authTokens.get(email);
        const chatUrl = token
          ? `${siteUrl}/chat?token=${token}&email=${encodeURIComponent(email)}`
          : `${siteUrl}/chat`;
        const subscriberName = nameByEmail.get(email);

        // Build auth-carrying briefing URL so clicking from email auto-logs the user in
        const briefingUrl = token
          ? `${siteUrl}/sign-in?token=${token}&email=${encodeURIComponent(email)}`
          : `${siteUrl}/archive/${date}`;

        // Append auth token to PDF URL so Pro subscribers can download without a prior session
        const subscriberPdfUrl = (pdfUrl && token)
          ? `${pdfUrl}?token=${token}&email=${encodeURIComponent(email)}`
          : pdfUrl;

        const unsubscribeUrl = token
          ? `${siteUrl}/sign-in?token=${token}&email=${encodeURIComponent(email)}`
          : `${siteUrl}/sign-in`;

        let html = htmlTemplate
          .replace(/%%CHAT_URL%%/g, chatUrl)
          .replace(/%%PDF_URL%%/g, subscriberPdfUrl)
          .replace(/%%BRIEFING_URL%%/g, briefingUrl)
          .replace(/%%UNSUBSCRIBE_URL%%/g, unsubscribeUrl);
        let text = textTemplate
          .replace(/%%CHAT_URL%%/g, chatUrl)
          .replace(/%%BRIEFING_URL%%/g, briefingUrl)
          .replace(/%%UNSUBSCRIBE_URL%%/g, unsubscribeUrl);

        // If no PDF was generated, remove the PDF link from the email
        if (!subscriberPdfUrl) {
          html = html.replace(/<a[^>]*href=""[^>]*>[\s\S]*?Download PDF[\s\S]*?<\/a>/i, "");
        }

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

    logger.info("Digest send complete", { sent: totalSent, failed: totalFailed });
    return { sent: totalSent, failed: totalFailed };
  },
});
