# BTC Today — Architecture

## File Structure

```
BTC_Website/
├── CLAUDE.md
├── docs/
│   ├── plan.md                        # Implementation phases
│   ├── architecture.md                # This file
│   ├── orchestrator.md                # Pipeline code reference
│   └── decisions.md                   # Key technical decisions
├── Skills/                            # Preserved
├── .env.example
├── .env.local                         # gitignored
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── trigger.config.ts
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root: fonts, metadata, dark theme
│   │   ├── page.tsx                   # Homepage — latest briefing
│   │   ├── globals.css                # Tailwind v4 @import + @theme
│   │   ├── archive/
│   │   │   ├── page.tsx
│   │   │   └── [date]/
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── revalidate/route.ts
│   │       └── subscribe/route.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── Container.tsx
│   │   ├── briefing/
│   │   │   ├── DailyDiffBanner.tsx
│   │   │   ├── NarrativeConsensus.tsx
│   │   │   ├── MarketSnapshot.tsx
│   │   │   ├── TopStories.tsx
│   │   │   ├── StoryCard.tsx          # "use client" — ELIN toggle
│   │   │   ├── TechnicalSignals.tsx
│   │   │   ├── BtcVsEverything.tsx
│   │   │   ├── FeeComparison.tsx
│   │   │   ├── NetworkHealth.tsx
│   │   │   ├── CommunityVoices.tsx
│   │   │   ├── CountdownEvents.tsx
│   │   │   └── LookingAhead.tsx
│   │   ├── subscribe/
│   │   │   └── SubscribeForm.tsx      # "use client"
│   │   └── ui/
│   │       ├── ToggleSwitch.tsx
│   │       ├── Gauge.tsx
│   │       └── Badge.tsx
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── resend.ts
│   │   ├── types.ts                   # BriefingJSON master interface
│   │   ├── constants.ts
│   │   └── utils.ts
│   │
│   └── trigger/
│       ├── daily-pipeline.ts          # Orchestrator (cron)
│       ├── collectors/
│       │   ├── news.ts
│       │   ├── youtube.ts
│       │   └── market.ts
│       ├── processors/
│       │   ├── ai-brain.ts
│       │   └── enrichment.ts
│       ├── publishers/
│       │   ├── save-briefing.ts
│       │   ├── revalidate-site.ts
│       │   └── send-digest.ts
│       └── lib/
│           ├── searchapi.ts
│           ├── rss.ts
│           ├── youtube-transcript.ts
│           ├── coingecko.ts
│           ├── mempool.ts
│           ├── alternativeme.ts
│           ├── technical-indicators.ts
│           ├── comparison.ts
│           ├── anthropic.ts
│           └── perplexity.ts
│
├── emails/
│   └── daily-digest.tsx
│
└── public/
    ├── favicon.ico
    └── fonts/                         # Space Grotesk + IBM Plex Sans
```

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, ISR) |
| Pipeline | Trigger.dev v3 (cron tasks) |
| Database | Supabase (Postgres + RLS) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |
| AI | Claude Sonnet (briefing), Perplexity sonar-pro (enrichment) |
| Email | Resend + React Email |

## Data Flow

```
6 AM CET daily:

  ┌─ news collector ──────┐
  │  (SearchAPI + RSS)     │
  │                        │
  ├─ youtube collector ────┤──→ AI Brain (Claude) ──→ Enrichment (Perplexity)
  │  (RSS + transcripts)   │         │                       │
  │                        │         ▼                       ▼
  └─ market collector ─────┘    BriefingJSON ◄── looking_ahead
     (CoinGecko, Mempool,           │
      F&G, Yahoo, Alpha V)          ├──→ Save to Supabase
                                    ├──→ Revalidate Next.js (ISR)
                                    └──→ Send email digest (Resend)
```

## Cost

~$2-3/month. All services on free tiers except minimal Anthropic + Perplexity API usage.
