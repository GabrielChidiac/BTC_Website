import { schedules, logger } from "@trigger.dev/sdk/v3";
import { CLAUDE_MODEL, pingModel, pingKie } from "@/trigger/lib/anthropic";
import { sendOwnerAlert } from "@/trigger/lib/alert";

// Below this Kie.ai balance, warn ahead of time. A full pipeline day on the
// fallback costs a few credits; 15 leaves a few days of runway to top up.
const KIE_LOW_CREDIT_THRESHOLD = 15;

const ANTHROPIC_FIX: Record<"retired" | "billing" | "auth", { subject: string; fix: string[] }> = {
  retired: {
    subject: `Claude model ${CLAUDE_MODEL} returned 404 (likely retired)`,
    fix: [
      `This almost always means Anthropic retired the model.`,
      `Fix: update the CLAUDE_MODEL constant in src/trigger/lib/anthropic.ts to a`,
      `current model id (Anthropic model list / migration guide), then deploy to main.`,
    ],
  },
  billing: {
    subject: `Anthropic credit balance exhausted`,
    fix: [
      `Anthropic is refusing requests for billing reasons (usually "credit balance is too low").`,
      `Fix: console.anthropic.com > Settings > Billing. Buy credits AND turn on auto-reload`,
      `so this cannot recur. No code change or deploy needed; the next run picks it up.`,
    ],
  },
  auth: {
    subject: `Anthropic API key rejected (401/403)`,
    fix: [
      `The ANTHROPIC_API_KEY in the Trigger.dev production environment was rejected.`,
      `Fix: create a new key in console.anthropic.com and update it in the Trigger.dev`,
      `dashboard (Environment Variables > prod).`,
    ],
  },
};

// Daily canary that runs 30 minutes BEFORE the main pipeline (01:00 UTC / 2 AM
// CET). It confirms BOTH Claude providers will serve tonight's run:
//  - Anthropic (primary): alerts on retirement (404), billing (credit
//    exhausted, the 2026-10-03..06 incident) and auth failures. Transient
//    errors (429/5xx/network) are logged, not alerted, so a blip never cries wolf.
//  - Kie.ai (fallback): alerts when the fallback itself is broken or low on
//    credits. The fallback rotted unnoticed from June to October because nothing
//    exercised it until the primary was already down.
// Severity: "critical" when tonight's briefing will degrade to the data-only
// fallback (primary AND fallback both broken); "degraded" when one provider is
// down but the other still covers the run.
export const modelPreflightTask = schedules.task({
  id: "model-preflight",
  cron: "30 0 * * *", // 00:30 UTC daily — 30 min before daily-pipeline (01:00 UTC)
  maxDuration: 120,
  run: async () => {
    logger.info("Model preflight started", { model: CLAUDE_MODEL });
    const [anthropic, kie] = await Promise.all([pingModel(), pingKie()]);

    const anthropicDown = !anthropic.ok && anthropic.kind !== "transient";
    const kieDown = !kie.ok;
    const kieLow = kie.credits !== null && kie.credits < KIE_LOW_CREDIT_THRESHOLD;

    logger.info("Model preflight results", {
      model: CLAUDE_MODEL,
      anthropic: anthropic.ok ? "ok" : `${anthropic.kind}: ${anthropic.detail}`,
      kie: kie.ok ? "ok" : kie.detail,
      kieCredits: kie.credits,
    });

    if (!anthropic.ok && anthropic.kind === "transient") {
      logger.warn("Anthropic preflight inconclusive — transient error, not alerting", {
        detail: anthropic.detail,
      });
    }

    // Anthropic down is ALWAYS critical. Kie.ai's gateway hard-cuts requests
    // at ~111s (verified 2026-10-06, streaming too), and the Synthesizer's
    // ~3-4k-token output sits right at that edge, so Kie.ai reliably covers
    // triage/classifier/analyst but NOT the Synthesizer. Never promise the
    // owner a full-quality brief on the fallback alone.
    if (anthropicDown) {
      const { subject, fix } = ANTHROPIC_FIX[anthropic.kind as "retired" | "billing" | "auth"];
      await sendOwnerAlert({
        severity: "critical",
        subject,
        text: [
          `Preflight for tonight's 2 AM CET briefing failed on Anthropic (primary).`,
          ``,
          `Model: ${CLAUDE_MODEL}`,
          `Detail: ${anthropic.detail}`,
          ``,
          kieDown
            ? `The Kie.ai fallback is ALSO down (${kie.detail}). Tonight's briefing WILL degrade to the data-only fallback (no stories, no narrative) unless this is fixed first.`
            : `The Kie.ai fallback is reachable (${kie.credits ?? "?"} credits) and will cover the small calls, but it often times out on the full Synthesizer briefing. Expect a degraded, data-only brief tonight unless this is fixed first.`,
          ``,
          ...fix,
        ].join("\n"),
      });
    }

    if (kieDown && !anthropicDown) {
      await sendOwnerAlert({
        severity: "degraded",
        subject: `Kie.ai Claude fallback is down`,
        text: [
          `Preflight could not get a response from the Kie.ai fallback.`,
          ``,
          `Detail: ${kie.detail}`,
          `Credits: ${kie.credits ?? "unknown"}`,
          ``,
          `Anthropic (primary) is healthy, so tonight's briefing is unaffected. But if`,
          `Anthropic fails, there is no fallback and the briefing degrades to data-only.`,
          `Fix: check kie.ai dashboard (credits, API key, model ${CLAUDE_MODEL} still`,
          `offered at /claude/v1/messages) and the kieMessages() helper in`,
          `src/trigger/lib/anthropic.ts.`,
        ].join("\n"),
      });
    }

    if (!kieDown && kieLow) {
      await sendOwnerAlert({
        severity: "degraded",
        subject: `Kie.ai credits low (${kie.credits})`,
        text: [
          `The Kie.ai Claude fallback has ${kie.credits} credits left (threshold ${KIE_LOW_CREDIT_THRESHOLD}).`,
          `Top up at kie.ai so the fallback still works the next time Anthropic fails.`,
        ].join("\n"),
      });
    }

    return {
      ok: anthropic.ok && kie.ok,
      model: CLAUDE_MODEL,
      anthropic: anthropic.ok ? "ok" : anthropic.kind,
      kie: kie.ok ? "ok" : "down",
      kieCredits: kie.credits,
    };
  },
});
