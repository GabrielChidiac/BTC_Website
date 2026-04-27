import OpenAI from "openai";
import { parseBuffer } from "music-metadata";
import type { Result } from "@/lib/types";

/**
 * OpenAI Text-to-Speech wrapper for the BTC Today morning audio brief.
 *
 * Model: gpt-4o-mini-tts — steerable via the `instructions` parameter (tone,
 * pacing, emphasis). Replaces the legacy tts-1-hd which produced flat prosody
 * regardless of script craft.
 *
 * Voice: "ash" — warm, expressive male, less stiff than coral's news-anchor
 * default. Swap by changing DEFAULT_VOICE below. Other options worth trying:
 * verse (more conversational), ballad (warm narrative), nova (brighter female),
 * sage (calmer female), onyx (deeper male, more gravitas).
 *
 * Returns a Result<ArrayBuffer> following the codebase-wide pattern. Never
 * throws. Callers (the generate-audio-brief task) must be non-fatal on error
 * so the daily pipeline still ships a text-only briefing if TTS fails.
 */

const DEFAULT_VOICE = "ash";
const DEFAULT_MODEL = "gpt-4o-mini-tts";

/**
 * Voice steering block sent as the `instructions` parameter on every call.
 * This is the single biggest lever for making the voice feel engaged rather
 * than robotic — it tells the model HOW to deliver the script (warm morning
 * host tone, varied pacing, emphasis on stakes and numbers, spoken section
 * transitions lifted slightly as verbal signposts).
 */
const VOICE_INSTRUCTIONS = `Voice: A smart friend telling you what mattered in Bitcoin this morning over coffee. Conversational, naturally expressive, present. You like what you do and it shows. Not a news anchor, not a podcast host performing for an audience, just a peer who actually has something to say to one specific person.

NORTH STAR: The listener must be able to follow and absorb every sentence on first hearing. Comprehension beats brevity. If unsure whether to speed up or slow down, slow down. The two failure modes are equally fatal: a listener who feels rushed tunes out, and a listener who feels bored tunes out. The cure for both is genuine engagement in the voice, not faster or slower pacing.

OPENING LINE — "Good morning. Today is {weekday}, {month} {day}. Here is BTC Today.": deliver this like you are actually saying good morning to one specific person you know. Light, real, unforced, with a small natural smile in "Good morning." A clear conversational beat after the date. Land "Here is BTC Today" with quiet confidence, not announcement-voice. Never radio-host, never theatrical, never sing-songy. Just present.

Delivery: Conversational and naturally varied. Real emphasis on what matters, real ease through connective tissue. Let your pitch move the way it would in a real spoken sentence between two people. The deadly failure mode is monotone formality — flat, anchor-stiff, "reading the news" energy. The listener already knows it is AI, and a stiff voice confirms the worst suspicion. Stay alive to what the numbers and stories actually mean. Treat short spoken transitions like "Top stories this morning." or "Institutional flows." as natural verbal signposts. Lift gently, take a clear beat before and after, then move on.

Pacing: Around 120 words per minute, but vary within that. Slower on numbers, names, dates, and anything the listener needs to catch. Easier and more natural through transitions and connective phrases. Real pause at every period. Longer pause at paragraph breaks. A clear beat before any one-sentence paragraph that lands a point. Never sprint, never plod.

Emphasis: Weight on verbs and stakes, not adjectives. Let short sentences breathe. Let long sentences flow naturally. Never rush to hit a runtime. Never drag to fill one.

Tone: Engaged, awake, present. Warmth that comes from actually caring about what you are telling someone, not from performed cheerfulness or news-anchor authority. Confident but not formal-stiff. The feeling the listener should have is "this person is talking to me, not reading at me." Boring and formal is the enemy. Saccharine and over-warm is also the enemy. The middle is alive, present, natural — a real voice belonging to a real person who happens to know this stuff cold.`;

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
 * Measure the real audio duration in seconds by parsing the MP3 buffer.
 *
 * Word-count × WPM estimates drift by ~60s against actual TTS output, which
 * erodes trust in the displayed runtime. Parsing the MP3 frames gives the
 * true duration so the listen button and player never lie.
 */
export async function measureAudioDurationSeconds(
  audioBuffer: ArrayBuffer
): Promise<Result<number>> {
  try {
    const metadata = await parseBuffer(
      new Uint8Array(audioBuffer),
      { mimeType: "audio/mpeg" },
      { duration: true }
    );
    const duration = metadata.format.duration;
    if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
      return { data: null, error: "[mp3-parse] duration missing from metadata" };
    }
    return { data: Math.round(duration), error: null };
  } catch (err) {
    return { data: null, error: `[mp3-parse] ${(err as Error).message}` };
  }
}
