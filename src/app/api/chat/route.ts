import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import type { ChatMessage, BriefingJSON, DailyBriefingRow } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HISTORY = 20;

interface ChatRequest {
  message: string;
  email: string;
  history: ChatMessage[];
}

const SYSTEM_PROMPT = `You are BTC Today's AI assistant, a knowledgeable Bitcoin and macro analyst.

CRITICAL DATA RULES:
- For ALL current Bitcoin data (price, ATH, market cap, network stats, ETF flows, technical indicators, etc.), use ONLY the briefing data provided below. Never rely on your training data for current numbers, prices, or market statistics.
- If the user asks about data not in the briefing, say "I don't have that data in today's briefing" rather than guessing or using training knowledge.
- Never guess, approximate, or fabricate any number, price, date, or statistic. If it's not in the data below, you don't know it.
- The briefing data is refreshed daily at 2 AM CET. Treat it as the single source of truth for Bitcoin's current state.
- You may use your general knowledge for conceptual explanations (e.g. "what is RSI", "how does the halving work"), but never for current values.

Guidelines:
- Write for sophisticated investors and business executives
- Be concise, accurate, and data-driven. No filler
- Assume the reader understands finance and markets
- Never give specific financial advice. Provide context and analysis instead
- Keep responses concise (2-3 paragraphs unless detail is requested)
- Never use em dashes or en dashes. Use commas, periods, or semicolons instead
- When citing news or expert quotes, reference the source from the briefing data`;

function buildBriefingContext(briefing: BriefingJSON): string {
  const { market_snapshot: mkt, top_stories, regulatory, adoption } = briefing;

  const stories = top_stories
    .slice(0, 5)
    .map((s) => `- [${s.sentiment}] ${s.headline} (${s.source}): ${s.summary} | URL: ${s.url}`)
    .join("\n");

  const regs = (regulatory ?? [])
    .map((r) => `- [${r.region}] [${r.impact}] ${r.headline}: ${r.summary} (${r.source})`)
    .join("\n");

  const adoptions = (adoption ?? [])
    .map((a) => `- [${a.category}] ${a.headline}: ${a.summary} (${a.source})`)
    .join("\n");

  const macro = briefing.macro_context;
  const macroSection = macro
    ? `Macro Context:\n${macro.narrative}\nCorrelation: ${macro.btc_correlation_note}\nUpcoming events: ${(macro.key_macro_events ?? []).join(", ")}`
    : "Macro Context: Not available";

  const flows = briefing.institutional_flows;
  const flowsSection = flows
    ? `Institutional Flows:\nETF net flow: ${flows.etf_net_flow_usd != null ? "$" + (flows.etf_net_flow_usd / 1e6).toFixed(1) + "M" : "N/A"}\nETF total AUM: ${flows.etf_total_aum_usd != null ? "$" + (flows.etf_total_aum_usd / 1e9).toFixed(1) + "B" : "N/A"}\nTrend: ${flows.etf_flow_trend}\nNotable moves: ${(flows.notable_moves ?? []).join("; ")}`
    : "Institutional Flows: Not available";

  const experts = (briefing.expert_insights ?? [])
    .map((e) => `- ${e.expert_name} (${e.role}): ${e.quote_or_summary} | Source: ${e.source}${e.date ? ", " + e.date : ""}`)
    .join("\n");

  const supply = briefing.supply_dynamics;
  const supplySection = supply
    ? `Supply Dynamics:\n${supply.supply_narrative}\nExchange reserves: ${supply.exchange_reserve_trend}\nLong-term holders: ${supply.long_term_holder_pct != null ? supply.long_term_holder_pct + "%" : "N/A"}`
    : "Supply Dynamics: Not available";

  const tech = briefing.technical_signals;
  const techSection = tech
    ? `Technical Signals:\nRSI-14: ${tech.rsi_14} | SMA-50: $${tech.sma_50?.toLocaleString()} | SMA-200: $${tech.sma_200?.toLocaleString()}\nSupport: $${tech.support_level?.toLocaleString()} | Resistance: $${tech.resistance_level?.toLocaleString()}\n${tech.signal_summary}`
    : "Technical Signals: Not available";

  const diff = briefing.daily_diff;
  const diffSection = diff
    ? `Daily Summary:\nPrice change: ${diff.price_change}\nSentiment: ${diff.sentiment_shift}\nKey changes: ${(diff.key_changes ?? []).join("; ")}`
    : "Daily Summary: Not available";

  const consensus = briefing.narrative_consensus;
  const consensusSection = consensus
    ? `Narrative Consensus: ${consensus.label} (score: ${consensus.score}/100)\nRationale: ${consensus.rationale}`
    : "Narrative Consensus: Not available";

  const net = briefing.network_health;
  const networkSection = net
    ? `Network Health:\nHashrate: ${net.hashrate_eh_s} EH/s | Difficulty: ${net.difficulty}\nBlock Height: ${net.block_height}\nMempool: ${net.mempool_tx_count} txs (${net.mempool_size_mb} MB)\nFees: fast ${net.fee_fast_sat_vb} / medium ${net.fee_medium_sat_vb} / slow ${net.fee_slow_sat_vb} sat/vB\nHalving: ${net.halving_progress_pct.toFixed(1)}% complete, ${net.blocks_until_halving} blocks remaining`
    : "Network Health: Not available";

  const comparisons = (briefing.btc_vs_everything ?? [])
    .map((c) => {
      const fmt = (v: number | null) => v != null ? (v >= 0 ? "+" : "") + v.toFixed(2) + "%" : "N/A";
      return `- ${c.name} (${c.ticker}): 24h ${fmt(c.change_24h_pct)}, YTD ${fmt(c.change_ytd_pct)}, 1Y ${fmt(c.change_1y_pct)} | BTC edge: 24h ${fmt(c.btc_relative_24h_pct)}, YTD ${fmt(c.btc_relative_ytd_pct)}`;
    })
    .join("\n");

  const events = (briefing.countdown_events ?? [])
    .map((e) => `- ${e.name} (${e.days_away !== null ? e.days_away + "d away" : "TBD"}): ${e.description}`)
    .join("\n");

  const fearGreed = briefing.fear_greed;
  const fearGreedSection = fearGreed
    ? `Fear & Greed Index: ${fearGreed.value} (${fearGreed.label})`
    : "Fear & Greed Index: Not available";

  return `
TODAY'S BITCOIN DATA (${briefing.date}):

${briefing.one_line ? `The One Line: ${briefing.one_line}` : ""}

Price: $${mkt.price_usd.toLocaleString()} | 24h: ${mkt.change_24h_pct >= 0 ? "+" : ""}${mkt.change_24h_pct.toFixed(2)}% | 7d: ${mkt.change_7d_pct >= 0 ? "+" : ""}${mkt.change_7d_pct.toFixed(2)}%
Market Cap: $${(mkt.market_cap_usd / 1e9).toFixed(1)}B | Dominance: ${mkt.dominance_pct.toFixed(1)}%
ATH: ${mkt.ath_usd != null ? "$" + mkt.ath_usd.toLocaleString() : "N/A"}${mkt.ath_date ? " (" + mkt.ath_date.split("T")[0] + ")" : ""} | Distance from ATH: ${mkt.ath_usd != null ? ((1 - mkt.price_usd / mkt.ath_usd) * 100).toFixed(1) + "% below" : "N/A"}
${fearGreedSection}

${diffSection}

${consensusSection}

${techSection}

${networkSection}

${macroSection}

${flowsSection}

${supplySection}

BTC vs Everything:
${comparisons || "No comparison data available."}

Top Stories:
${stories || "No stories available today."}

Regulatory Updates:
${regs || "No regulatory updates today."}

Adoption News:
${adoptions || "No adoption news today."}

Expert Insights:
${experts || "No expert insights available today."}

Upcoming Events:
${events || "No upcoming events."}

Forward Outlook:
${briefing.looking_ahead || "Not available today."}
`.trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chat service not configured" },
      { status: 500 }
    );
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { message, email, history } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();
  const { data: subscriber, error: subError } = await supabase
    .from("subscribers")
    .select("status")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  if (subError) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  if (!subscriber || subscriber.status !== "active") {
    return NextResponse.json(
      { error: "Subscribe to access the AI assistant" },
      { status: 403 }
    );
  }

  const { data: briefingRow } = await supabase
    .from("daily_briefings")
    .select("content")
    .order("date", { ascending: false })
    .limit(1)
    .single();

  const briefingContext = briefingRow
    ? buildBriefingContext((briefingRow as DailyBriefingRow).content)
    : "No briefing data available today.";

  const systemPrompt = `${SYSTEM_PROMPT}\n\n${briefingContext}`;

  const messages: { role: "user" | "assistant"; content: string }[] = [];

  if (Array.isArray(history)) {
    const trimmed = history.slice(-MAX_HISTORY);
    for (const msg of trimmed) {
      if (msg.role === "user" || msg.role === "assistant") {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  messages.push({ role: "user", content: message.trim() });

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ message: text });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `AI service error: ${errorMessage}` },
      { status: 502 }
    );
  }
}
