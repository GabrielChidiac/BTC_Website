# src/trigger/audio-brief/CLAUDE.md

Scoped guidance for the audio brief (Pillar 2). See [/CLAUDE.md](/CLAUDE.md) for global rules and [../CLAUDE.md](../CLAUDE.md) for pipeline orchestration.

## Scope
Generates the 4-minute Pro audio brief. **Load-bearing feature**; never remove the script generation, TTS synthesis, the `/listen/[date]` route, the `/api/audio/[date]` route, or audio UI without explicit user approval.

## Files
- [generate-audio-brief.ts](generate-audio-brief.ts) — Trigger task. Orchestrates: Claude script call → strip section markers → OpenAI TTS → upload MP3 to Supabase Storage bucket `briefing-audio` as `YYYY-MM-DD.mp3` → return `audio_url`, `audio_duration_seconds`, `audio_script` for merge into BriefingJSON.
- [prompts.ts](prompts.ts) — System and user prompt builders, FACTS BLOCK rendering. **The system prompt at the top is canonical.**

## Hard rules
- **Word target: 440-490 words.** At 120 WPM (comprehension-paced) this lands at 3:40-4:05 of audio.
- **Voice: 120 WPM**, never raise to hit a shorter runtime. Comprehension > brevity. 4:10-4:15 is acceptable; feeling rushed is a failure mode.
- **Locked CLOSE line, verbatim, no variation:** `"That is today. See you tomorrow, BTC Today."`
- **9-section structure:** OPEN, MARKET SNAPSHOT, TOP STORIES, ADOPTION, REGULATORY, INSTITUTIONAL FLOWS, DEEP DIVE, OUTLOOK, CLOSE. Section markers like `[OPEN]` are stripped before TTS so brackets are not read aloud.
- **OPEN appends `day_classification.day_tone_line`** when present. Tone line is a closed phrase set defined in [../processors/day-classifier.ts](../processors/day-classifier.ts) so it never contradicts the label.

## FACTS BLOCK pattern
The user prompt feeds Claude a plain-text enumerated FACTS BLOCK (not JSON) so Claude is forced to use *today's* data instead of training-data priors. Every number in the script must come from the block; every name, headline, company, event, and date must come from the block. This is the highest-priority rule (RULE 1: DATA ACCURACY).

If a fact is missing, Claude says `"no notable [x] today"` and moves on. Never invents.

## Pronunciation discipline
Acronyms must be phonetically spelled with spaces or fully written out:
- IBIT → "I bit"
- FBTC → "F B T C"
- ARKB → "A R K B"
- ETF → "E T F"
- FOMC → "Federal Reserve rate decision meeting"
- SEC, CPI, PCE, PPI, GDP, RSI → spelled with spaces

## Voice steering
[../lib/openai-tts.ts](../lib/openai-tts.ts) holds the `VOICE_INSTRUCTIONS` block fed to OpenAI TTS as steering. Voice: `ash`. Edit there, not in prompts.ts.

## Anti-patterns
- Never raise WPM to fit a shorter target.
- Never edit the locked CLOSE line without explicit user approval.
- Never use em dashes (—) or en dashes anywhere in the script.
- Never quote an expert who is not in the FACTS BLOCK's EXPERT VOICE section.
- Never include citation markers like `[1]`, `[2]` in script text.
