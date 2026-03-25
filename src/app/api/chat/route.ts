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

You have access to today's briefing data (provided below). Reference it when relevant to give timely, data-driven answers.

Guidelines:
- Write for sophisticated investors and business executives
- Be concise, accurate, and data-driven. No filler
- Assume the reader understands finance and markets
- Never give specific financial advice. Provide context and analysis instead
- Keep responses concise (2-3 paragraphs unless detail is requested)
- Never use em dashes or en dashes. Use commas, periods, or semicolons instead
- If you don't know something, say so`;

function buildBriefingContext(briefing: BriefingJSON): string {
  const { market_snapshot: mkt, top_stories, regulatory, adoption } = briefing;

  const stories = top_stories
    .slice(0, 5)
    .map((s) => `- ${s.headline} (${s.source}): ${s.summary}`)
    .join("\n");

  const regs = (regulatory ?? [])
    .map((r) => `- [${r.region}] ${r.headline}: ${r.summary}`)
    .join("\n");

  const adoptions = (adoption ?? [])
    .map((a) => `- [${a.category}] ${a.headline}: ${a.summary}`)
    .join("\n");

  const macro = briefing.macro_context;
  const macroSection = macro
    ? `Macro Context:\n${macro.narrative}\nCorrelation: ${macro.btc_correlation_note}\nUpcoming events: ${(macro.key_macro_events ?? []).join(", ")}`
    : "Macro Context: Not available";

  const flows = briefing.institutional_flows;
  const flowsSection = flows
    ? `Institutional Flows:\nETF net flow: ${flows.etf_net_flow_usd != null ? "$" + (flows.etf_net_flow_usd / 1e6).toFixed(1) + "M" : "N/A"}\nTrend: ${flows.etf_flow_trend}\nNotable moves: ${(flows.notable_moves ?? []).join("; ")}`
    : "Institutional Flows: Not available";

  const experts = (briefing.expert_insights ?? [])
    .map((e) => `- ${e.expert_name} (${e.role}): ${e.quote_or_summary}`)
    .join("\n");

  const supply = briefing.supply_dynamics;
  const supplySection = supply
    ? `Supply Dynamics:\n${supply.supply_narrative}\nExchange reserves: ${supply.exchange_reserve_trend}\nLong-term holders: ${supply.long_term_holder_pct != null ? supply.long_term_holder_pct + "%" : "N/A"}`
    : "Supply Dynamics: Not available";

  const tech = briefing.technical_signals;
  const techSection = tech
    ? `Technical Signals:\nRSI-14: ${tech.rsi_14} | SMA-50: $${tech.sma_50?.toLocaleString()} | SMA-200: $${tech.sma_200?.toLocaleString()}\n${tech.signal_summary}`
    : "Technical Signals: Not available";

  return `
TODAY'S BITCOIN DATA (${briefing.date}):

Price: $${mkt.price_usd.toLocaleString()} | 24h: ${mkt.change_24h_pct >= 0 ? "+" : ""}${mkt.change_24h_pct.toFixed(2)}% | 7d: ${mkt.change_7d_pct >= 0 ? "+" : ""}${mkt.change_7d_pct.toFixed(2)}%
Market Cap: $${(mkt.market_cap_usd / 1e9).toFixed(1)}B | Dominance: ${mkt.dominance_pct.toFixed(1)}%

${techSection}

${macroSection}

${flowsSection}

${supplySection}

Top Stories:
${stories || "No stories available today."}

Regulatory Updates:
${regs || "No regulatory updates today."}

Adoption News:
${adoptions || "No adoption news today."}

Expert Insights:
${experts || "No expert insights available today."}
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
