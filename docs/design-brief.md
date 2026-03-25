# BTC Today — Design Brief for External Designer

## What This Is
A daily AI-curated Bitcoin intelligence briefing for high-net-worth individuals and executives. Think Bloomberg Terminal meets Axios — information-dense but scannable, premium but not flashy.

**Live site**: Deployed on Vercel with Next.js. Data refreshes daily at 6 AM CET via AI pipeline.

---

## Target Audience
- Busy executives, institutional investors, HNW individuals
- NOT beginners — no "What is Bitcoin?" content
- They scan, they don't read. Every section must earn its space.
- Think: the person checking this over coffee before a 9 AM board meeting

## Design Direction
- **Aesthetic**: Bloomberg editorial / financial times / Axios smart brevity
- **Theme**: Light/platinum — warm whites, not cold
- **Density**: High information density, but with clear hierarchy (not a wall of data)
- **Feel**: Confident, institutional, data-driven. Let the data speak.

---

## Color System (Locked — Do Not Change)
| Token | Value | Usage |
|-------|-------|-------|
| Background | `#FFF8F0` | Page base — warm platinum |
| Surface | `#FFFFFF` | Cards, elevated elements |
| Elevated | `#FFF9F3` | Hover states, secondary surfaces |
| Accent | `#F7931A` | BTC orange — CTAs, highlights, section labels |
| Blue | `#3B82F6` | Atmospheric only — background blobs, not UI |
| Text Primary | `#2D2D34` | Headlines, key data |
| Text Secondary | `#5C5C66` | Body text, summaries |
| Text Muted | `#9C9CA6` | Labels, timestamps, captions |
| Border | `#E8E4DF` | Card borders, dividers |

## Typography (Locked — Do Not Change)
- **Headings**: Space Grotesk — tracking `-0.03em`, line-height `1.2`
- **Body**: IBM Plex Sans — line-height `1.7`

---

## Current Section Order (Implemented)

### 1. Hero (Above the Fold)
- Animated Bitcoin coin with glow/pulse
- Large animated price counter ($71,260)
- 24h and 7d percentage changes
- Sentiment summary (1-2 sentences)
- Key changes as badge pills

### 2. The Day in 30 Seconds
- Axios-style bullets: **bold lead sentence** + supporting context
- Left border accent (orange for macro, blue for correlation)
- Upcoming events as compact tags at bottom

### 3. Market Intelligence (2-Column Grid)
- **Left**: Institutional Flows — ETF net flow (large number), trend narrative, notable moves
- **Right**: BTC vs Everything — comparison table (Asset | 24h | YTD | BTC Edge)
- Stacks to single column on mobile

### 4. Top Stories
- Featured story #1: Large card with headline, summary, sentiment badge, tags
- Stories #2-4: Compact rows — headline + source + sentiment badge only

### 5. Signals (Adoption + Regulatory Combined)
- Mixed list of adoption and regulatory updates
- Each item: category badge + headline + 1-line summary + source
- Compact, scannable

### 6. Subscribe CTA
- Shimmer-border animated card
- "Get the daily briefing in your inbox"
- Email input + subscribe button

### 7. Footer
- Subscribe form (repeated)
- Tagline + data refresh timestamp

---

## What a Designer Should Focus On
1. **Layout polish**: Spacing, rhythm, visual hierarchy between sections
2. **Section differentiation**: Each section should feel visually distinct — not identical cards
3. **Data visualization**: Suggest sparklines, mini-charts, or heatmaps for the Market Intelligence section
4. **Mobile experience**: Currently max-w-3xl — ensure it feels intentional on mobile, not just "responsive"
5. **Above-the-fold impact**: The hero is strong but could be tighter
6. **Micro-interactions**: Hover states, focus rings, transition timing

## What NOT to Change
- The data structure (JSON schema is fixed by the AI pipeline)
- The color palette or fonts
- The section order (already validated with users)
- Backend/pipeline architecture

## Technical Constraints
- **Framework**: Next.js 16 with App Router (React Server Components)
- **Styling**: Tailwind CSS v4 (CSS-only config, no tailwind.config.js)
- **No external CSS libraries** — everything is utility-first
- **No images** — all visuals are CSS/SVG
- **Animations**: `transform` and `opacity` only — no `transition-all`

## Deliverables Expected
- Figma file with desktop (1440px) and mobile (375px) mockups
- Design tokens if proposing spacing/sizing changes
- Component-level annotations (not just full-page screenshots)

---

*Generated March 2026 — BTC Today*
