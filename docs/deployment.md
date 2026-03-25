# BTC Today — Deployment Guide

## Prerequisites

- [Vercel](https://vercel.com) account (free Hobby plan works)
- [Trigger.dev](https://trigger.dev) account (free Developer plan — 50k runs/mo)
- [Supabase](https://supabase.com) project (free plan — 500MB database)
- [Resend](https://resend.com) account (free — 3k emails/mo)
- API keys for: Anthropic, Perplexity, SearchAPI.io, CoinGecko (free Demo), Alpha Vantage (free)

---

## 1. Supabase Setup

1. Create a new Supabase project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor** and run the migration:
   ```
   supabase/migrations/001_initial_schema.sql
   ```
3. Note your project credentials from **Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

### Verify

In the Table Editor you should see two tables: `daily_briefings` and `subscribers`, both with RLS enabled.

---

## 2. Vercel Deployment

### Connect Repository

1. Push your code to a GitHub/GitLab/Bitbucket repo
2. In the Vercel dashboard, **Add New Project** → import the repo
3. Framework preset: **Next.js** (auto-detected)
4. Build settings (defaults are correct):
   - Build command: `next build`
   - Output directory: `.next`
   - Install command: `npm install`

### Environment Variables

Add all variables from `.env.example` in **Settings → Environment Variables**:

| Variable | Value | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude Sonnet |
| `PERPLEXITY_API_KEY` | `pplx-...` | sonar-pro |
| `KIE_API_KEY` | (optional) | Claude fallback |
| `SEARCHAPI_KEY` | Your key | Google News |
| `COINGECKO_API_KEY` | Your demo key | Free, no CC |
| `ALPHA_VANTAGE_API_KEY` | Your key | Free, 25 req/day |
| `TRIGGER_SECRET_KEY` | `tr_dev_...` | From Trigger.dev dashboard |
| `RESEND_API_KEY` | `re_...` | Email sending |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | Public key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` | Secret — server only |
| `REVALIDATION_SECRET` | Any strong random string | Protects `/api/revalidate` |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.vercel.app` | Used in emails |

### Custom Domain (Optional)

1. **Settings → Domains** → add your domain (e.g., `btctoday.dev`)
2. Add the DNS records Vercel provides
3. Update `NEXT_PUBLIC_SITE_URL` to your custom domain

### Deploy

Click **Deploy**. Vercel will build and deploy automatically on every push to `main`.

---

## 3. Trigger.dev Setup

### Create Project

1. Sign up at [cloud.trigger.dev](https://cloud.trigger.dev)
2. Create a new project named `btc-today`
3. Copy the **Server API Key** → this is your `TRIGGER_SECRET_KEY`

### Deploy Tasks

From your local machine (or CI):

```bash
npx trigger.dev@latest deploy
```

This bundles and deploys all tasks from `src/trigger/` to Trigger.dev's cloud runtime.

### Verify Cron Schedule

After deploying, go to the Trigger.dev dashboard:
- Navigate to **Schedules**
- Confirm `daily-pipeline` is registered with cron `0 5 * * *` (5:00 UTC = 6:00 CET)

### Manual Test Run

1. In the Trigger.dev dashboard, go to **Tasks → daily-pipeline**
2. Click **Test** to trigger a manual run
3. Watch the run logs to verify:
   - All 3 collectors complete (news, youtube, market)
   - AI Brain produces valid BriefingJSON
   - Enrichment adds `looking_ahead` (or falls back gracefully)
   - Briefing saves to Supabase
   - Site revalidation succeeds
   - Email digest sends (if subscribers exist)

### Environment Variables in Trigger.dev

Trigger.dev tasks run in their own runtime, so they need their own env vars. In the Trigger.dev dashboard, go to **Settings → Environment Variables** and add:

| Variable | Required |
|---|---|
| `ANTHROPIC_API_KEY` | Yes |
| `PERPLEXITY_API_KEY` | Yes |
| `KIE_API_KEY` | No (fallback) |
| `SEARCHAPI_KEY` | Yes |
| `COINGECKO_API_KEY` | Yes |
| `ALPHA_VANTAGE_API_KEY` | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes |
| `RESEND_API_KEY` | Yes |
| `REVALIDATION_SECRET` | Yes (must match Vercel) |
| `NEXT_PUBLIC_SITE_URL` | Yes (your production URL) |

---

## 4. Resend Email Setup

1. Go to [resend.com/domains](https://resend.com/domains) and add your domain
2. Add the DNS records (SPF, DKIM, DMARC) Resend provides
3. Verify the domain
4. Update the `from` address in `src/trigger/publishers/send-digest.ts` and `src/app/api/subscribe/route.ts` to use your verified domain (e.g., `digest@yourdomain.com`)

Without a verified domain, Resend can only send to the account owner's email.

---

## 5. Post-Deployment Checklist

- [ ] Supabase migration applied — tables visible in dashboard
- [ ] Vercel build succeeds — site loads at your URL
- [ ] Homepage shows "Your first briefing publishes at 6 AM CET" (no data yet)
- [ ] Subscribe form works — email appears in `subscribers` table
- [ ] Trigger.dev tasks deployed — visible in dashboard
- [ ] Cron schedule registered — `0 5 * * *`
- [ ] Manual pipeline test run completes successfully
- [ ] Briefing appears on homepage after test run
- [ ] Archive page lists the briefing
- [ ] Email received (if subscriber exists)
- [ ] `REVALIDATION_SECRET` matches between Vercel and Trigger.dev

---

## 6. Seed Data (Optional)

To test the frontend without running the full pipeline:

1. Open Supabase **SQL Editor**
2. Paste and run `scripts/seed-test-briefing.sql`
3. Visit your site — the briefing should render immediately
4. Delete the seed after testing: `DELETE FROM daily_briefings WHERE date = '2026-03-24';`

---

## Cost Estimate

| Service | Plan | Monthly Cost |
|---|---|---|
| Vercel | Hobby (free) | $0 |
| Trigger.dev | Developer (free, 50k runs) | $0 |
| Supabase | Free (500MB) | $0 |
| Resend | Free (3k emails/mo) | $0 |
| Anthropic | Pay-as-you-go (~1 call/day) | ~$1-2 |
| Perplexity | Pay-as-you-go (~1 call/day) | ~$0.50-1 |
| SearchAPI.io | Free (100 searches/mo) | $0 |
| CoinGecko | Demo (free) | $0 |
| Alpha Vantage | Free (25 req/day) | $0 |
| **Total** | | **~$2-3/month** |

---

## Troubleshooting

### Pipeline fails at AI Brain
- Check Anthropic API key is valid and has credits
- Check Trigger.dev logs for the exact error
- Kie.ai fallback activates automatically on 429/5xx from Anthropic

### Revalidation fails
- Ensure `REVALIDATION_SECRET` matches in both Vercel and Trigger.dev
- Ensure `NEXT_PUBLIC_SITE_URL` in Trigger.dev points to your production URL (not localhost)

### Emails not sending
- Verify your domain in Resend dashboard
- Check the `from` address uses your verified domain
- Free plan: first 3,000 emails/month

### No data on homepage
- Run the pipeline manually from Trigger.dev dashboard
- Or seed test data via `scripts/seed-test-briefing.sql`
- Check Supabase `daily_briefings` table for entries

### Build fails locally but works on Vercel (or vice versa)
- Ensure Node.js version matches (18+ required)
- Run `npm ci` for clean install
- Check all env vars are set
