import { schedules, logger } from "@trigger.dev/sdk/v3";
import { CLAUDE_MODEL, pingModel } from "@/trigger/lib/anthropic";
import { sendOwnerAlert } from "@/trigger/lib/alert";

// Daily canary that runs 30 minutes BEFORE the main pipeline (01:00 UTC / 2 AM
// CET). It confirms Anthropic still serves CLAUDE_MODEL. If the model has been
// retired/invalidated (404), the whole pipeline would otherwise silently
// degrade to the data-derived fallback — exactly what happened on 2026-06-16
// when claude-sonnet-4-20250514 retired. This converts that silent next-morning
// post-mortem into a loud, specific alert that names the model and the one-line
// fix. Transient errors (429/5xx/network) are logged but NOT alerted, so a blip
// at canary time never cries wolf.
export const modelPreflightTask = schedules.task({
  id: "model-preflight",
  cron: "30 0 * * *", // 00:30 UTC daily — 30 min before daily-pipeline (01:00 UTC)
  maxDuration: 120,
  run: async () => {
    logger.info("Model preflight started", { model: CLAUDE_MODEL });
    const result = await pingModel();

    if (result.ok) {
      logger.info("Model preflight passed", { model: CLAUDE_MODEL });
      return { ok: true, model: CLAUDE_MODEL };
    }

    if (result.retired) {
      logger.error("Model preflight FAILED — model retired/invalid (404)", {
        model: CLAUDE_MODEL,
        detail: result.detail,
      });
      await sendOwnerAlert({
        severity: "critical",
        subject: `Claude model ${CLAUDE_MODEL} returned 404 (likely retired)`,
        text: [
          `The daily pipeline's Claude model returned 404 from Anthropic during preflight.`,
          ``,
          `Model: ${CLAUDE_MODEL}`,
          `Detail: ${result.detail}`,
          ``,
          `This almost always means Anthropic retired the model. Tonight's 2 AM CET`,
          `briefing will degrade to the data-derived fallback unless this is fixed first.`,
          ``,
          `Fix: update the CLAUDE_MODEL constant in src/trigger/lib/anthropic.ts to a`,
          `current model id (Anthropic model list / migration guide), then deploy to main.`,
        ].join("\n"),
      });
      return { ok: false, retired: true, model: CLAUDE_MODEL };
    }

    // Non-404 (transient: rate limit, 5xx, network). Log, don't alert.
    logger.warn("Model preflight inconclusive — transient error, not alerting", {
      model: CLAUDE_MODEL,
      detail: result.detail,
    });
    return { ok: false, retired: false, model: CLAUDE_MODEL };
  },
});
