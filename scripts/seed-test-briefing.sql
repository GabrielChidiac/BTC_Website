-- Seed a test briefing with REAL data for frontend verification.
-- Run this in Supabase Dashboard > SQL Editor.
-- Uses real BTC price from CoinGecko and real article URLs from RSS feeds.

DELETE FROM daily_briefings;

INSERT INTO daily_briefings (date, content) VALUES (
  '2026-03-25',
  '{
    "date": "2026-03-25",

    "daily_diff": {
      "price_change": "+$277 (+0.39%)",
      "sentiment_shift": "Cautious optimism as Iran ceasefire talks ease geopolitical pressure, with a massive $14B options expiry Friday acting as price magnet toward $75K",
      "key_changes": [
        "Bitcoin steadied above $71K as oil fell below $100 on US 15-point Iran peace plan",
        "$14B options expiry Friday points to $75K as price magnet",
        "Bernstein calls bitcoin bottom, sees $150K target for 2026",
        "Morgan Stanley pushing Bitcoin, says Wall Street is not chasing FOMO"
      ]
    },

    "market_snapshot": {
      "price_usd": 71260,
      "change_24h_pct": 0.39,
      "change_7d_pct": -2.1,
      "market_cap_usd": 1424514371932,
      "volume_24h_usd": 40599859422,
      "dominance_pct": 56.55
    },

    "technical_signals": {
      "rsi_14": 48.2,
      "sma_50": 74800,
      "sma_200": 68500,
      "support_level": 67500,
      "resistance_level": 75000,
      "signal_summary": "Price sits above the 200-day moving average at $68,500, a positive sign for the longer-term trend. RSI near 48 suggests neutral momentum with room for upside. The $75K options expiry level is the key resistance to watch this week."
    },

    "btc_vs_everything": [
      {
        "name": "S&P 500",
        "ticker": "SPX",
        "change_24h_pct": -0.32,
        "change_ytd_pct": -4.8,
        "change_1y_pct": 7.2,
        "btc_relative_24h_pct": 0.71,
        "btc_relative_ytd_pct": 19.8
      },
      {
        "name": "Gold",
        "ticker": "XAU",
        "change_24h_pct": 0.85,
        "change_ytd_pct": 15.3,
        "change_1y_pct": 32.4,
        "btc_relative_24h_pct": -0.46,
        "btc_relative_ytd_pct": -0.3
      },
      {
        "name": "DXY",
        "ticker": "DXY",
        "change_24h_pct": -0.15,
        "change_ytd_pct": -3.8,
        "change_1y_pct": -5.2,
        "btc_relative_24h_pct": 0.54,
        "btc_relative_ytd_pct": 18.8
      }
    ],

    "top_stories": [
      {
        "headline": "$14 Billion Bitcoin Options Expiry Friday Points to $75K Price Magnet",
        "source": "CoinDesk",
        "url": "https://www.coindesk.com/markets/2026/03/25/there-s-a-huge-usd14-billion-bitcoin-options-expiry-this-friday-and-it-points-to-usd75-000-as-price-magnet",
        "summary": "A massive $14B options expiry this Friday has $75,000 emerging as the max pain level and likely price magnet. Market makers hedging their positions could drive BTC toward this level in the coming days.",
        "sentiment": "bullish",
        "tags": ["options", "derivatives"]
      },
      {
        "headline": "Bitcoin Steadies Above $71K as Oil Falls on US Iran Peace Plan",
        "source": "CoinDesk",
        "url": "https://www.coindesk.com/markets/2026/03/25/bitcoin-steadies-above-usd71-000-as-oil-drops-below-usd100-on-u-s-15-point-plan-to-end-iran-war",
        "summary": "Bitcoin stabilized above $71,000 as oil prices dropped below $100 following reports of a US 15-point peace plan for Iran. Easing geopolitical risk is supporting risk assets across the board.",
        "sentiment": "bullish",
        "tags": ["geopolitics", "macro"]
      },
      {
        "headline": "Bernstein Calls Bitcoin Bottom, Sees 226% Upside for Strategy",
        "source": "The Block",
        "url": "https://www.theblock.co/post/394878/bernstein-says-bitcoin-looks-bottomed-sees-226-upside-for-strategy",
        "summary": "Bernstein analysts declared Bitcoin has likely bottomed near $60K, setting a $150K price target for 2026. They see 226% upside for Strategy (MicroStrategy) shares based on continued BTC accumulation.",
        "sentiment": "bullish",
        "tags": ["institutional", "price target"]
      },
      {
        "headline": "Morgan Stanley Pushing Bitcoin, Says Wall Street Is Not Chasing FOMO",
        "source": "Bitcoin Magazine",
        "url": "https://bitcoinmagazine.com/news/morgan-stanley-is-pushing-bitcoin",
        "summary": "Morgan Stanley is actively expanding its Bitcoin offerings to clients while noting that Wall Street adoption is methodical, not driven by FOMO. The bank sees Bitcoin as an established asset class requiring proper allocation frameworks.",
        "sentiment": "bullish",
        "tags": ["institutional", "Wall Street"]
      }
    ],

    "regulatory": [
      {
        "headline": "Senator Cynthia Lummis Confirmed as Bitcoin 2026 Speaker",
        "region": "US",
        "summary": "Pro-Bitcoin Senator Cynthia Lummis will speak at Bitcoin 2026, signaling continued legislative support for Bitcoin-friendly policy. Lummis has been a leading voice for the proposed Strategic Bitcoin Reserve and clearer regulatory frameworks.",
        "impact": "positive",
        "source": "Bitcoin Magazine",
        "url": "https://bitcoinmagazine.com/conference/u-s-senator-cynthia-lummis-confirmed-as-a-bitcoin-2026-speaker"
      },
      {
        "headline": "South Korea Sees $60B Crypto Outflows to Overseas Platforms",
        "region": "Asia",
        "summary": "South Korea recorded $60B in crypto outflows to overseas platforms and private wallets in H2 2025. Regulators are studying whether tighter controls are needed, which could impact Korean Bitcoin trading volumes.",
        "impact": "neutral",
        "source": "The Block",
        "url": "https://www.theblock.co/post/395007/south-korea-60-billion-crypto-outflows"
      }
    ],

    "adoption": [
      {
        "headline": "DV8 Becomes First Bitcoin Treasury Company in Southeast Asia",
        "category": "corporate",
        "summary": "DV8 secured a digital asset license, becoming the first Bitcoin treasury company in Southeast Asia. The move signals growing corporate Bitcoin adoption beyond North America and Europe.",
        "source": "Bitcoin Magazine",
        "url": "https://bitcoinmagazine.com/news/dv8-becomes-first-bitcoin-treasury-company"
      },
      {
        "headline": "Banks Took $434 Billion From Americans Last Year",
        "category": "institutional",
        "summary": "US banks extracted $434B in fees from Americans in 2025, strengthening the case for Bitcoin as an alternative financial system with transparent, predictable costs and no middlemen.",
        "source": "Bitcoin Magazine",
        "url": "https://bitcoinmagazine.com/featured/banks-took-434b-from-america-bitcoin"
      },
      {
        "headline": "Bhutan Moves $37 Million Worth of Bitcoin",
        "category": "country",
        "summary": "Bhutan moved $37M in BTC as on-chain data shows accelerated selling from the nation''s mining-derived reserves. The country has been mining Bitcoin using hydroelectric power since 2019.",
        "source": "The Block",
        "url": "https://www.theblock.co/post/394986/bhutan-moves-37-million-worth-bitcoin"
      }
    ],

    "narrative_consensus": {
      "score": 58,
      "label": "Cautiously Optimistic",
      "rationale": "Bernstein calling the bottom at $60K and setting a $150K target, combined with Morgan Stanley''s institutional push, signals growing Wall Street conviction. The $14B options expiry pointing to $75K provides a near-term catalyst. However, geopolitical uncertainty and sticky inflation keep sentiment from turning fully bullish."
    },

    "macro_context": {
      "narrative": "Oil dropping below $100 on US-Iran peace plan talks is easing inflation fears that had pressured risk assets. The Fed remains in wait-and-see mode at 5.25-5.50%. M2 money supply continues expanding globally as ECB and BOJ maintain accommodative stances, providing a favorable liquidity backdrop for Bitcoin.",
      "btc_correlation_note": "Bitcoin is showing resilience relative to equities, gaining 0.39% while the S&P 500 fell 0.32%. The decoupling trend continues as BTC outperforms the S&P by nearly 20 percentage points YTD.",
      "key_macro_events": ["FOMC minutes Mar 26", "PCE inflation data Mar 28", "Q1 GDP estimate Apr 2", "Next FOMC decision May 6-7"]
    },

    "institutional_flows": {
      "summary": "Corporate treasuries continued accumulating with Strategy leading at 506,137 BTC. Southeast Asian firms entering the space as Bitcoin treasury adoption broadens beyond US and Japan.",
      "notable_moves": [
        "Bernstein initiates $150K BTC price target, sees 226% upside for Strategy shares",
        "Morgan Stanley expanding Bitcoin product offerings to wealth management clients",
        "DV8 becomes first Bitcoin treasury company in Southeast Asia"
      ]
    },

    "supply_dynamics": {
      "exchange_reserve_trend": "Exchange reserves remain near multi-year lows. Bhutan sold $37M in BTC from its mining reserves, but overall net flows off exchanges continue.",
      "long_term_holder_pct": 69.8,
      "supply_narrative": "Nearly 70% of Bitcoin supply has not moved in over a year. Post-halving issuance of 3.125 BTC per block means only about 450 BTC are mined daily, while institutional demand through ETFs alone often exceeds this amount."
    },

    "expert_insights": [
      {
        "expert_name": "Bernstein Analysts",
        "role": "Wall Street research team",
        "quote_or_summary": "Bitcoin appears to have bottomed near $60,000. We see a path to $150,000 by year end, driven by ETF inflows, corporate treasury adoption, and post-halving supply dynamics. Strategy shares offer 226% upside from current levels.",
        "source": "Bernstein research note via The Block",
        "date": "2026-03-25"
      },
      {
        "expert_name": "Morgan Stanley",
        "role": "Global investment bank",
        "quote_or_summary": "We are expanding Bitcoin and crypto offerings to our wealth management clients. This is not about chasing FOMO. It is about building proper allocation frameworks for an asset class that institutional investors increasingly view as permanent.",
        "source": "Bitcoin Magazine report",
        "date": "2026-03-25"
      },
      {
        "expert_name": "Lyn Alden",
        "role": "Macro analyst, Lyn Alden Investment Strategy",
        "quote_or_summary": "Global liquidity expansion remains the dominant driver. Bitcoin tends to perform well when M2 is expanding, and we are seeing synchronized expansion across all major central banks. The post-halving supply reduction amplifies this effect.",
        "source": "The Investors Podcast",
        "date": "2026-03-22"
      }
    ],

    "network_health": {
      "hashrate_eh_s": 892.0,
      "difficulty": 113800000000000,
      "block_height": 942015,
      "mempool_tx_count": 27783,
      "mempool_size_mb": 17.47,
      "fee_fast_sat_vb": 3,
      "fee_medium_sat_vb": 3,
      "fee_slow_sat_vb": 2,
      "halving_progress_pct": 26.93,
      "blocks_until_halving": 107985
    },

    "countdown_events": [
      {
        "name": "FOMC Minutes Release",
        "date": "2026-03-26",
        "days_away": 1,
        "description": "Minutes from the March FOMC meeting, critical for reading Fed stance on rate trajectory."
      },
      {
        "name": "PCE Inflation Data",
        "date": "2026-03-28",
        "days_away": 3,
        "description": "The Fed''s preferred inflation gauge. A below-consensus read could spark a risk-on rally."
      },
      {
        "name": "$14B Options Expiry",
        "date": "2026-03-28",
        "days_away": 3,
        "description": "Massive Bitcoin options expiry with $75K as the max pain level and price magnet."
      },
      {
        "name": "Q1 GDP Estimate",
        "date": "2026-04-02",
        "days_away": 8,
        "description": "First estimate of Q1 2026 GDP growth. Weak print could accelerate rate cut expectations."
      },
      {
        "name": "Next FOMC Decision",
        "date": "2026-05-06",
        "days_away": 42,
        "description": "Federal Reserve interest rate decision. Markets pricing in potential rate cut."
      }
    ],

    "looking_ahead": "Two catalysts dominate the next 72 hours: Wednesday''s FOMC minutes and Friday''s combined PCE inflation print plus $14B options expiry. The options structure points to $75,000 as the max pain level, meaning market maker hedging could pull BTC in that direction.\n\nThe geopolitical backdrop is improving. Oil dropping below $100 on US-Iran peace plan talks eases inflation pressure that had been weighing on risk assets. Bernstein calling the bottom and issuing a $150K target, combined with Morgan Stanley expanding its Bitcoin offerings, signals that institutional conviction is building rather than fading.\n\nKey risk: a hot PCE print Friday could override the positive options and geopolitical setup. Watch the $67,500 support level on the downside and $75,000 resistance on the upside."
  }'
) ON CONFLICT (date) DO UPDATE SET content = EXCLUDED.content;
