import OpenAI from "openai";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Generates a TTS sample MP3 for each candidate female voice on
 * gpt-4o-mini-tts using the same script paragraph and the same
 * VOICE_INSTRUCTIONS shape as production. Lets you A/B by ear before
 * locking in DEFAULT_VOICE in src/trigger/lib/openai-tts.ts.
 *
 * Run: node --env-file=.env scripts/voice-sample.mjs
 * Output: scripts/voice-samples/<voice>.mp3
 */

const VOICES = ["coral", "nova", "shimmer"];
const MODEL = "gpt-4o-mini-tts";
const OUT_DIR = resolve(process.cwd(), "scripts/voice-samples");

const SAMPLE_SCRIPT = `Good morning. Today is Tuesday, April 28th. Here is BTC Today.

Bitcoin is at ninety-four thousand two hundred dollars, up two point one percent in the last twenty-four hours. Volume is running about thirty percent above the thirty-day average, which tells you this move has real participation behind it, not just a thin tape.

Top stories this morning. The big one: a Fortune 500 treasurer just disclosed a four hundred million dollar bitcoin allocation. That is not a corporate test position. That is a strategic move, and it is the third one this month.

Looking ahead. Watch the FOMC minutes on Wednesday and the spot ETF flow data tomorrow morning. If institutional bid stays this firm, the next leg up is a question of when, not if.`;

const VOICE_INSTRUCTIONS = `Voice: A warm, joyful, genuinely engaged morning host. Female voice. Bright but not bubbly, present but not performing. You are talking to one specific person you actually like, telling them what mattered in Bitcoin this morning over coffee. Real warmth, real interest, real smile in the voice.

NORTH STAR: The listener must follow every sentence on first hearing. Comprehension beats brevity. The two failure modes are equally fatal: rushed (listener tunes out) and flat (listener tunes out). Cure for both is genuine engagement, not pace.

OPENING LINE: deliver "Good morning" with a real, unforced smile, like you are actually greeting one person. Conversational beat after the date. Land "Here is BTC Today" with quiet, warm confidence. Not announcement-voice. Not sing-songy. Present.

Delivery: Conversational and varied. Real emphasis on what matters, real ease through connective tissue. Pitch moves the way it would in a real spoken sentence between two people. Avoid monotone formality at all costs. Stay alive to what the numbers and stories actually mean. Treat short transitions like "Top stories this morning." as natural verbal signposts, lift gently, take a beat, then move on.

Pacing: Around 120 words per minute, varied within. Slower on numbers, names, dates. Easier through transitions. Real pause at periods, longer at paragraph breaks. Never sprint, never plod.

Tone: Warm, joyful, awake, present. Warmth from actually caring about what you are telling someone, not from performed cheerfulness. Confident but not formal. The feeling: "this person is talking to me." Stiff and saccharine are both the enemy. The middle is alive, present, and natural.`;

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY not set. Run with: node --env-file=.env scripts/voice-sample.mjs");
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const client = new OpenAI({ apiKey });

  for (const voice of VOICES) {
    process.stdout.write(`[${voice}] generating... `);
    const t0 = Date.now();
    try {
      const response = await client.audio.speech.create({
        model: MODEL,
        voice,
        input: SAMPLE_SCRIPT,
        instructions: VOICE_INSTRUCTIONS,
        response_format: "mp3",
      });
      const buf = Buffer.from(await response.arrayBuffer());
      const path = resolve(OUT_DIR, `${voice}.mp3`);
      await writeFile(path, buf);
      console.log(`done in ${Date.now() - t0}ms → ${path} (${(buf.length / 1024).toFixed(1)} KB)`);
    } catch (err) {
      console.log(`FAIL: ${err.message}`);
    }
  }

  console.log(`\nOpen ${OUT_DIR} and play each MP3. Pick by ear, then update DEFAULT_VOICE in src/trigger/lib/openai-tts.ts.`);
}

main();
