import OpenAI from "openai";
import type { Result } from "@/lib/types";

/**
 * OpenAI Text-to-Speech wrapper for the BTC Today morning audio brief.
 *
 * Model: gpt-4o-mini-tts — steerable via the `instructions` parameter (tone,
 * pacing, emphasis). Replaces the legacy tts-1-hd which produced flat prosody
 * regardless of script craft.
 *
 * Voice: "coral" — warm female news-host voice. Swap by changing DEFAULT_VOICE
 * below. Other female options: sage (calmer), nova (brighter), shimmer (softer).
 *
 * Returns a Result<ArrayBuffer> following the codebase-wide pattern. Never
 * throws. Callers (the generate-audio-brief task) must be non-fatal on error
 * so the daily pipeline still ships a text-only briefing if TTS fails.
 */

const DEFAULT_VOICE = "coral";
const DEFAULT_MODEL = "gpt-4o-mini-tts";

/**
 * Voice steering block sent as the `instructions` parameter on every call.
 * This is the single biggest lever for making the voice feel engaged rather
 * than robotic — it tells the model HOW to deliver the script (warm morning
 * host tone, varied pacing, emphasis on stakes and numbers, spoken section
 * transitions lifted slightly as verbal signposts).
 */
const VOICE_INSTRUCTIONS = `Voice: Warm, confident morning news host. Imagine telling a smart, busy friend what they need to know before their first meeting.

Delivery: Conversational but precise. Forward-leaning energy, engaged, interested, alive to what the numbers mean. Never monotone, never hyped. Treat short spoken section transitions like "Top stories this morning." or "Institutional flows." as verbal signposts, lift the voice slightly, take a small beat before and after so the listener feels the brief move from one part to the next.

Pacing: Vary deliberately. Slow down on numbers, names, and stakes so they land. Speed up slightly through connective tissue. Take a micro-beat before punchlines and one-sentence paragraphs.

Emphasis: Put weight on verbs and stakes, not adjectives. Let short sentences breathe. Let long sentences flow.

Tone: Authoritative calm with warmth underneath. Confident, not theatrical. This listener pays for brevity and respect, give them both.`;

const TTS_TIMEOUT_MS = 120_000;

export async function generateSpeech(
  scriptText: string
): Promise<Result<ArrayBuffer>> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { data: null, error: "[openai-tts] OPENAI_API_KEY is not set" };
  }

  if (!scriptText || scriptText.trim().length === 0) {
    return { data: null, error: "[openai-tts] Empty script text" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

  try {
    const client = new OpenAI({ apiKey, maxRetries: 1 });
    const response = await client.audio.speech.create(
      {
        model: DEFAULT_MODEL,
        voice: DEFAULT_VOICE,
        input: scriptText,
        instructions: VOICE_INSTRUCTIONS,
        response_format: "mp3",
      },
      { signal: controller.signal, timeout: TTS_TIMEOUT_MS }
    );

    const arrayBuffer = await response.arrayBuffer();
    return { data: arrayBuffer, error: null };
  } catch (err) {
    const e = err as Error;
    const msg = controller.signal.aborted
      ? `timed out after ${TTS_TIMEOUT_MS}ms`
      : e.message;
    return { data: null, error: `[openai-tts] ${msg}` };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Strip the section markers ([OPEN], [THE MOVE], etc.) from the script
 * before sending to TTS. The markers are for human debugging only, not for
 * the voice model. Spoken section transitions (e.g., "Top stories this
 * morning.") are written as real sentences inside the sections and survive
 * this stripping unchanged.
 */
export function stripSectionMarkers(script: string): string {
  return script
    .replace(/\[[A-Z\s]+\]\s*\n?/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Estimate audio duration in seconds from a spoken-word script at the
 * approximate natural cadence of OpenAI TTS voices (150 words per minute).
 * Used as a fallback when the actual MP3 duration is not known.
 */
export function estimateAudioDurationSeconds(scriptText: string): number {
  const wordsPerMinute = 150;
  const wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  return Math.round((wordCount / wordsPerMinute) * 60);
}
