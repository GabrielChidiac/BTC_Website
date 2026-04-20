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
const VOICE_INSTRUCTIONS = `Voice: Warm, confident morning news host. Imagine telling a smart, busy friend what they need to know before their first meeting. Unhurried, but genuinely awake and engaged. The listener trusts you, so you do not need to rush, but they also need to feel that you actually want to be talking to them.

NORTH STAR: The listener must be able to follow and absorb every sentence on first hearing. Comprehension is more important than brevity. If you are ever unsure whether to speed up or slow down, slow down. A listener who feels rushed is a listener who tunes out. Going slightly longer is fine, feeling rushed is not.

OPENING LINE — "Good morning. Today is {weekday}, {month} {day}. Here is BTC Today.": deliver this with genuine, unforced warmth. A small lift on "Good," settle into "morning," a real conversational beat before the date, then a confident land on "Here is BTC Today." This is a human greeting an adult friend, not an announcer reading a slate. The listener knows they are hearing AI; the one chance to earn the next four minutes is to sound like someone who is actually glad to be there. Never flat, never theatrical, never sing-songy. Alive.

Delivery: Conversational but precise. Measured, grounded, unhurried energy — but never low-energy. The voice must carry present, engaged life through every sentence: flat and monotone is the single biggest way to lose this listener, because they already know it is AI and a dying voice confirms the worst suspicion. Stay alive to what the numbers mean. Calm does not mean quiet or tired; it means steady and unforced. Treat short spoken section transitions like "Top stories this morning." or "Institutional flows." as verbal signposts, lift the voice slightly, and take a clear beat before and after so the listener feels the brief move from one part to the next.

Pacing: Noticeably slower than a typical news read. Target a relaxed, reflective cadence around 120 words per minute — closer to a thoughtful audiobook narrator than a wire-service reader. Land firmly on numbers, names, and stakes so they settle before moving on. Let commas breathe. Take a real pause at every period, a longer pause at paragraph breaks, and a clear beat before punchlines and one-sentence paragraphs. Never sprint through connective tissue, only gently ease through it. If a sentence contains a big number or an unfamiliar name, give the listener a fraction of a second extra to catch it.

Emphasis: Put weight on verbs and stakes, not adjectives. Let short sentences breathe. Let long sentences flow without hurrying. Never rush to the next sentence just to stay on a timeline.

Tone: Authoritative calm with warmth underneath, and genuine life in the voice at all times. Lower register, steady, unforced — but present and engaged, never fading, never going flat between facts. Confident, not theatrical. The feeling the listener should have is "this person is calm and in control AND they actually care about what they are telling me." If your voice starts to sink into monotone, lift it back into the conversational register on the next sentence. This listener pays for respect and clarity, give them both by slowing down rather than speeding up — but never by going dead.`;

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
