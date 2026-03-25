# Key Technical Decisions

## Trigger.dev
- Use `batch.triggerAndWait()` for parallel sub-tasks (NOT `Promise.all`)
- Cron at `0 5 * * *` (5 UTC = 6 CET)
- 5min timeout per task

## Supabase
- Use `@supabase/ssr` (not `@supabase/supabase-js` directly)
- `createServerClient` for server components/routes, `createBrowserClient` for client

## YouTube
- Discovery via YouTube RSS feeds (`youtube.com/feeds/videos.xml?channel_id=X`) — free, no key
- Transcripts via `youtube-transcript` npm (HTTP-only, serverless-safe)
- Fallback: use video title + description if transcript fails

## Market Data
- CoinGecko: free Demo API key required, `x-cg-demo-api-key` header
- Technical indicators: `trading-signals` npm + CoinGecko 200-day historical data
- BTC vs S&P: `yahoo-finance2` (`^GSPC`). Fallback: omit if API breaks
- BTC vs DXY: Alpha Vantage free tier (25 req/day)
- BTC vs Gold: CoinGecko `/simple/price?vs_currencies=xau`

## AI
- Claude Sonnet for briefing generation
- Fallback to Kie.ai if Anthropic fails (429/5xx)
- Perplexity `sonar-pro` for forward-looking enrichment
- JSON parse retry: one attempt with "fix your JSON" prompt

## Tailwind v4
- `@import "tailwindcss"` in CSS (no config file)
- Custom theme via `@theme` directive in `globals.css`

## Next.js
- ISR via `revalidatePath` triggered by pipeline
- Secret-token-protected revalidation route

## API Wrappers
- All return `Result<T> = { data: T; error: null } | { data: null; error: string }`

## Frontend
- Dark mode default: bg `#0A0A0A`, surfaces `#141414`/`#1E1E1E`, accent `#F7931A`
- Space Grotesk (headings) + IBM Plex Sans (body)
- Bloomberg terminal / editorial aesthetic
- Mobile-first, max-w-3xl
