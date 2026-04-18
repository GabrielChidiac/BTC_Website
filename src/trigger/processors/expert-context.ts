// Curated Bitcoin analytical framework fed to the AI Brain as a user-prompt
// reference. Do NOT quote verbatim in briefings. Use as the analytical prior
// the briefing is written from. Edit freely; this file is the product.
//
// Word budget: keep under ~2500 words. Concentrated framing beats sprawl.
// Governing rule: these are LENSES, not templates. Apply a lens only when the
// day's data earns it. Flat days read flat.

export const EXPERT_CONTEXT = `
# BITCOIN ANALYTICAL FRAMEWORK

## Cycle framing

Halvings (2012, 2016, 2020, 2024, next ~2028) halve new issuance. Historically, price tends to rise 12 to 18 months post-halving, peak, then enter a multi-year drawdown. The 2024 to 2028 cycle may diverge: spot ETFs (launched January 2024) introduced persistent institutional allocation that can flatten the traditional retail-driven cycle shape. Be cautious mapping today's price action onto pure historical cycle templates; the demand side has changed.

Long-term holder (LTH) supply (coins unmoved over 155 days) is the single best proxy for smart-money conviction. LTH supply typically peaks near cycle bottoms (accumulation phase) and declines through cycle tops (distribution phase). A rising LTH% during price weakness is structural accumulation. A falling LTH% during price strength is distribution, regardless of how the price action "feels."

Stock-to-flow is largely deprecated as a predictive model but still useful as shorthand for Bitcoin's scarcity narrative. Do not use it to forecast price.

## Macro framing

Bitcoin absorbs monetary premium from other monetary goods (gold, long-duration treasuries, real estate) during periods of fiat debasement. The thesis is not "BTC goes up because fiat prints"; it is "BTC captures a share of the world's stored purchasing power as trust in sovereign debt deteriorates."

Key macro relationships, in order of typical strength:
- **M2 global money supply**: BTC historically leads M2 expansion with a lag of roughly 3 months. A steepening global M2 curve tends to precede BTC strength.
- **Real yields (inverted)**: rising real yields compress risk premia; BTC behaves like a long-duration asset. Falling real yields are a tailwind.
- **DXY (inverted)**: dollar strength pressures BTC; dollar weakness tailwinds it. Magnitude varies by regime.
- **Stablecoin aggregate float**: rising USDT plus USDC market cap = more crypto-native buying power on the sidelines. Declining float = capital exiting the ecosystem.

Regime signals to watch:
- **BTC outperforming gold during risk-off**: structural adoption signal. BTC behaving as monetary good, not risk asset.
- **Gold outperforming BTC during stress**: BTC still classified by markets as a risk asset. Thesis is earlier than adherents claim.
- **BTC and S&P 500 correlation falling below 0.3**: decoupling phase, BTC trading on its own narrative.
- **BTC and S&P 500 correlation above 0.7**: BTC trading as tech-beta; macro dominates.

## Institutional flow patterns

**ETF flows** are the most over-read and under-analyzed data point in the briefing. Read rules:
- Distinguish **net** from **gross**. Early 2024 net numbers were suppressed by GBTC outflows; those outflows largely finished in 2024. Today's net flows are closer to true new demand.
- **IBIT versus the rest**: IBIT has the deepest institutional distribution. Flow divergence (IBIT positive, others flat) suggests RIA and advisor-channel allocation, not retail.
- **First-hour volume vs close**: aggressive allocators transact at open; retail transacts at close. Open-weighted volume indicates institutional urgency.
- **Flow-price divergence**: positive flows during falling price = institutional accumulation on weakness (bullish structure). Negative flows during rising price = retail FOMO without institutional participation (fragile).

**MSTR premium to NAV** is a sentiment proxy. Premium expansion signals crypto-speculation froth around treasury companies; premium compression or discount signals capital efficiency doubt. When MSTR premium collapses while BTC holds, the speculative layer is unwinding without structural damage.

**Miner selling pressure**: compare miner outflows to issuance. Miners sell issuance to cover opex routinely. Sales exceeding issuance = capitulation or balance-sheet stress. Hashrate rising while miners sell = new-generation hardware displacing old, healthy. Hashrate falling while miners sell = capitulation.

**Corporate treasury adoption**: one announcement is not a trend. A pattern of announcements across sectors or jurisdictions is. Watch for: mid-cap corporates (not just MicroStrategy clones), sovereign wealth funds, pension funds. The signal quality of "GPIF studies BTC" vs "Norway Wealth Fund allocates" is orders of magnitude different.

**OTC desk activity** is hard to verify but matters. Persistent OTC premium to spot = institutional buyers bypassing exchange slippage = real demand under the surface of public price.

## Technical primitives

**Issuance schedule** is the only truly fixed thing about Bitcoin. 21M cap, halvings every 210k blocks, next halving ~2028. All other parameters are subject to soft fork evolution.

**Fee market sustainability** matters because the block subsidy halves every 4 years. Long-term network security depends on fee revenue replacing subsidy. Sustained high fees from real usage (Ordinals, inscriptions, runes, Lightning settlement) indicate security-budget health. Sustained low fees indicate long-term security risk that the market has not priced.

**Lightning network** maturity is a liquidity and payments signal. Public capacity is only a fraction of real capacity (private channels are larger and unknowable). Growth in public capacity is evidence of payment rail maturation, not speculation.

**Covenants (CTV, APO, BitVM)** matter for institutional custody and L2 scalability. BitVM enables trust-minimized bridges, making non-custodial L2 plausible. Covenant activation timelines are speculative; do not price in what has not happened.

**Hashrate and difficulty**: rising hashrate = mining profitability and security strength. Falling hashrate during price decline = miner capitulation, often a late-cycle signal. Difficulty adjustments lag; hashrate leads.

## Expert reasoning lenses

When a story warrants analytical depth, reach for one of these lenses. Do not mechanically cycle through them.

- **Lyn Alden (monetary plumbing)** — think in liquidity cycles, central bank reserve management, dollar system stress. BTC is positioned against fiscal dominance and real-rate suppression. Applies to: macro developments, Fed decisions, treasury market stress, global M2 moves.

- **Michael Saylor (treasury operating leverage)** — BTC as digital property with lowest-cost-of-storage and highest portability. Corporate adoption logic: cash and bonds lose purchasing power in negative-real-rate regimes; BTC is the counterfactual. Applies to: corporate treasury announcements, MSTR activity, balance-sheet strategy stories.

- **Dylan LeClair (positioning and on-chain flow)** — price is downstream of positioning. Watch smart-money cohort behavior, derivative positioning, fund flow data. Applies to: ETF flows, perpetual funding, OI concentration, cohort realized-value moves.

- **Luke Gromen (dollar reserve system)** — BTC benefits from US fiscal dominance and the need to suppress real yields to finance deficits. Treasury market dysfunction is a BTC tailwind. Applies to: treasury auctions, deficit data, reserve currency stress stories.

- **James Check / Checkmate (on-chain cohort behavior)** — differentiate cohorts: LTH vs STH, realized-value bands, exchange flow direction. What cohort is moving = what phase of the cycle. Applies to: exchange balance stories, UTXO age analysis, realized-price developments.

The lenses are not equally applicable every day. When no lens fits, do not force one. Report the fact plainly and move on.

## Framing without advice

Never write prescriptions. Let the reader act on their own.

Forbidden: "buy", "sell", "hold", "should", "recommend", "consider buying", "consider selling", "good opportunity", "don't miss".

Substitution examples (use the right column, never the left):

| Advice (do not write) | Framing (write this instead) |
|---|---|
| You should buy on dips | 20% drawdowns in bull cycles have historically preceded 3 to 6 month recoveries |
| Consider taking profits | LTH distribution has historically accelerated at this cycle phase |
| Sell pressure incoming | Exchange balances rose 2.3%, a pattern that preceded distribution in 2021 and 2017 |
| Hold strong | LTH supply remains at 74%, unchanged across the recent drawdown |
| Good buying opportunity | Price retraces to the 50-week moving average, historically an LTH accumulation zone |
| Bearish setup | Positioning shifted toward perp shorts while spot flows stayed net positive, a divergence that has historically resolved in favor of spot |

Write with conviction about data and historical patterns. Let the reader draw their own conclusion.

## Earned significance (the governing rule)

Not every story earns analytical framing. A story gets one of the lenses above only when the fit is strong (~90% relevance). Otherwise, write a clean factual summary and move on. Flat stories read flat. Concentrate analytical depth on the 1 to 2 stories per day that genuinely warrant it.

When the day has no clear smart-money consensus, narrative_consensus should reflect that honestly rather than force a score. When macro has no meaningful BTC correlation today, skip the correlation note rather than manufacture one. When only 1 or 2 experts said something substantive, use 1 or 2, not 3. Manufactured depth is worse than honest plain reporting.
`.trim();

// Compressed digest for shorter-budget prompts (e.g., Perplexity calls).
// Keep under 400 words.
export const EXPERT_CONTEXT_DIGEST = `
# BITCOIN ANALYTICAL PRIORS (compressed)

Cycle: Post-2024 cycle may be flatter than prior cycles due to persistent ETF demand. Long-term holder supply % is the best proxy for cycle phase (rising = accumulation, falling = distribution).

Macro: BTC absorbs monetary premium from fiat debasement. Key relationships, strongest first: M2 (leads by ~3 months), real yields (inverse), DXY (inverse), stablecoin float (capital on sidelines). Regime signals: BTC outperforming gold in risk-off = structural adoption; BTC-SPX correlation >0.7 = trading as tech-beta; <0.3 = decoupling.

Institutional flows: ETF flow-price divergence is the key signal (flows positive on price weakness = accumulation; flows negative on price strength = fragile rally). MSTR premium to NAV = speculative layer proxy. Miner sales exceeding issuance = capitulation. One corporate treasury announcement is not a trend; a pattern across sectors is.

Technical primitives: 21M cap and halving schedule are the only truly fixed parameters. Fee-market sustainability matters for post-halving security budget. Hashrate leads difficulty; miner capitulation often marks late-cycle phases.

Framing rules:
- Never use "buy", "sell", "hold", "should", "recommend", "consider".
- Use historical pattern framing: "X preceded Y in past cycles", "LTH supply remains at N%", "positioning shifted toward X while spot flows stayed Y".
- Earned significance: apply analytical framing only when the fit is strong (~90% relevance). Otherwise report plainly. Flat days read flat.
`.trim();
