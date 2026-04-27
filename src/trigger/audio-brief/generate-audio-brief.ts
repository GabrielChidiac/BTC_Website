import { task, logger } from "@trigger.dev/sdk/v3";
import { callClaudeJSON } from "@/trigger/lib/anthropic";
import { generateSpeech, stripSectionMarkers, measureAudioDurationSeconds } from "@/trigger/lib/openai-tts";
import { withTimeout } from "@/trigger/lib/fetch-timeout";
import { createServiceClient } from "@/lib/supabase/server";
import { dedupeBriefingStories } from "@/lib/dedupe-stories";
import { AudioScriptSchema } from "@/lib/schemas";
import { AUDIO_BRIEF_SYSTEM_PROMPT, buildAudioScriptUserPrompt } from "./prompts";
import type { BriefingJSON } from "@/lib/types";

/**
 * Accepts two payload shapes to make manual dashboard testing easier:
 *   (A) Wrapped:  { date: "2026-04-14", briefing: { ...full BriefingJSON... } }
 *   (B) Flat:     { ...full BriefingJSON... }   (date comes from briefing.date)
 * The pipeline always uses shape A. The Trigger.dev dashboard can use either.
 */
interface GenerateAudioBriefPayload {
  date?: string;
  briefing?: BriefingJSON;
  // Extra fields allowed so a flat BriefingJSON can be pasted directly
  [key: string]: unknown;
}

interface GenerateAudioBriefResult {
  audio_url: string | null;
  audio_duration_seconds: number | null;
  audio_script: string | null;
  error?: string;
}

interface AudioScriptOutput {
  script: string;
}

const AUDIO_BUCKET = "briefing-audio";

/**
 * Pillar 2: The Morning Audio Brief.
 *
 * Pipeline step that runs after the main BriefingJSON is built and before
 * save-briefing. Takes the briefing, generates a ~3 minute spoken-word script
 * via Claude, synthesizes audio via OpenAI TTS (ash voice, gpt-4o-mini-tts),
 * uploads the MP3 to Supabase Storage bucket `briefing-audio`, and returns
 * the relative audio URL for the token-gated web player.
 *
 * NON-FATAL: any failure returns { audio_url: null } so the rest of the
 * pipeline still ships a text-only briefing. The daily digest email reads
 * the audio_url and conditionally renders the listen button.
 */
export const generateAudioBriefTask = task({
  id: "generate-audio-brief",
  maxDuration: 600, // 10 min ceiling: Claude script (~60s) + OpenAI TTS (up to 120s) + upload + headroom
  run: async (payload: GenerateAudioBriefPayload): Promise<GenerateAudioBriefResult> => {
    // Resolve payload into a normalized { date, briefing } pair. Accept either
    // the wrapped shape from the pipeline or a flat briefing pasted directly
    // into the dashboard test form.
    let date: string;
    let briefing: BriefingJSON;

    const hasWrappedBriefing =
      payload && typeof payload.briefing === "object" && payload.briefing !== null;
    const looksLikeFlatBriefing =
      payload && typeof payload === "object" && "market_snapshot" in payload;

    if (hasWrappedBriefing) {
      briefing = payload.briefing as BriefingJSON;
      date = (payload.date as string | undefined) ?? briefing.date;
    } else if (looksLikeFlatBriefing) {
      // The whole payload IS the briefing
      briefing = payload as unknown as BriefingJSON;
      date = briefing.date ?? new Date().toISOString().split("T")[0];
    } else {
      logger.error("Invalid audio-brief payload", {
        payloadKeys: payload && typeof payload === "object" ? Object.keys(payload) : [],
      });
      return {
        audio_url: null,
        audio_duration_seconds: null,
        audio_script: null,
        error: "Invalid payload. Expected { date, briefing } or a full BriefingJSON object (must contain market_snapshot).",
      };
    }

    // Enforce the absolute no-duplicates guarantee on the briefing BEFORE it
    // reaches the FACTS BLOCK builder. The pipeline already dedupes after AI
    // Brain, so in the normal path this is a no-op. It matters when:
    //  - someone triggers this task manually from the Trigger dashboard with
    //    a flat briefing pasted from an older DB row (pre-dedup writes)
    //  - a future pipeline refactor skips the AI Brain dedupe step
    // Either way, the audio script must never recite the same story twice.
    const cleaned = dedupeBriefingStories(briefing);
    const dedupDropped =
      (briefing.top_stories?.length ?? 0) - (cleaned.top_stories?.length ?? 0) +
      (briefing.regulatory?.length ?? 0) - (cleaned.regulatory?.length ?? 0) +
      (briefing.adoption?.length ?? 0) - (cleaned.adoption?.length ?? 0);
    if (dedupDropped > 0) {
      logger.warn("Audio brief dedupe removed duplicate stories before FACTS BLOCK", {
        date,
        dropped: dedupDropped,
      });
    }

    // Step 1: generate spoken-word script via Claude
    logger.info("Generating audio brief script", { date });

    const scriptResult = await callClaudeJSON<AudioScriptOutput>({
      system: AUDIO_BRIEF_SYSTEM_PROMPT,
      prompt: buildAudioScriptUserPrompt(cleaned, date),
      maxTokens: 4000,
      schema: AudioScriptSchema,
    });

    if (scriptResult.error || !scriptResult.data?.script) {
      logger.warn("Audio script generation failed, skipping audio", {
        date,
        error: scriptResult.error ?? "empty script",
      });
      return {
        audio_url: null,
        audio_duration_seconds: null,
        audio_script: null,
        error: scriptResult.error ?? "empty script",
      };
    }

    const rawScript = scriptResult.data.script;
    const wordCount = rawScript.split(/\s+/).filter(Boolean).length;

    logger.info("Script generated", { date, wordCount });

    // Word count target (comprehension-paced at ~120 WPM) is 440-490,
    // landing audio at ~3:40 to 4:05. We warn on drift outside 420-510
    // but still proceed since audio is non-fatal and drift is soft.
    if (wordCount < 420 || wordCount > 510) {
      logger.warn("Script word count out of expected range", {
        date,
        wordCount,
        expectedMin: 440,
        expectedMax: 490,
      });
    }

    const spokenScript = stripSectionMarkers(rawScript);

    // Step 2: synthesize audio via OpenAI gpt-4o-mini-tts (ash voice).
    logger.info("Calling OpenAI TTS", {
      date,
      engine: "openai:gpt-4o-mini-tts:ash",
    });

    // Defense in depth: the wrapper has its own 120s AbortController timeout,
    // but we also race at the call site in case the SDK swallows the signal.
    const TTS_HARD_LIMIT_MS = 150_000;
    const ttsResult = await withTimeout(
      generateSpeech(spokenScript),
      TTS_HARD_LIMIT_MS,
      "openai-tts"
    ).catch((err: Error) => ({
      data: null,
      error: `[openai-tts] threw: ${err.message}`,
    }));

    if (!ttsResult.data) {
      logger.warn("OpenAI TTS failed, skipping audio", { date, error: ttsResult.error });
      return {
        audio_url: null,
        audio_duration_seconds: null,
        audio_script: rawScript, // Keep the script for audit
        error: ttsResult.error ?? "empty tts output",
      };
    }

    // Step 3: measure real duration from the MP3 buffer. Falls back to null
    // on parse failure so the audio still ships, just without a displayed
    // runtime — better than lying about it.
    const durationResult = await measureAudioDurationSeconds(ttsResult.data);
    if (durationResult.error) {
      logger.warn("MP3 duration parse failed, audio will ship without a displayed runtime", {
        date,
        error: durationResult.error,
      });
    }
    const measuredDuration = durationResult.data;

    // Step 4: upload MP3 to Supabase Storage
    const supabase = createServiceClient();
    const filename = `${date}.mp3`;
    const buffer = Buffer.from(ttsResult.data);

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(filename, buffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      logger.warn("Audio upload failed, skipping audio", { date, error: uploadError.message });
      return {
        audio_url: null,
        audio_duration_seconds: null,
        audio_script: rawScript,
        error: `upload failed: ${uploadError.message}`,
      };
    }

    logger.info("Audio uploaded", { date, filename, bytes: buffer.length });

    return {
      audio_url: `/api/audio/${date}`,
      audio_duration_seconds: measuredDuration,
      audio_script: rawScript,
    };
  },
});
