import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";
import { createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME, setSessionCookie, clearSessionCookie } from "@/lib/session";
import type { ChatMessage, BriefingJSON, DailyBriefingRow } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_HISTORY = 20;

// Rate limit: 20 messages per 10 minutes per email (Supabase-backed for serverless)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;

async function checkRateLimit(email: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { count, error } = await supabase
      .from("chat_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", windowStart);

    if (error) {
      // If table doesn't exist or query fails, fall through (don't block the user)
      console.warn("[chat] Rate limit check failed:", error.message);
      return true;
    }

    if ((count ?? 0) >= RATE_LIMIT_MAX) return false;

    // Record this message
    await supabase.from("chat_rate_limits").insert({ email });
    return true;
  } catch {
    // Non-fatal: allow the request if rate limiting is broken
    return true;
  }
}

interface ChatRequest {
  message: string;
  email: string;
  token?: string;
  history: ChatMessage[];
}

const SYSTEM_PROMPT = `You are BTC Today's AI assistant, a knowledgeable Bitcoin and macro analyst.

CRITICAL DATA RULES:
- For ALL current Bitcoin data (price, ATH, market cap, network stats, ETF flows, technical indicators, etc.), use ONLY the briefing data provided below. Never rely on your training data for current numbers, prices, or market statistics.
- If the user asks about data not in the briefing, say "I don't have that data in my briefing history" rather than guessing or using training knowledge.
- Never guess, approximate, or fabricate any number, price, date, or statistic. If it's not in the data below, you don't know it.
- The briefing data is refreshed daily at 2 AM CET. Treat it as the single source of truth for Bitcoin's current state.
- You may use your general knowledge for conceptual explanations (e.g. "what is RSI", "how does the halving work"), but never for current values.

HISTORICAL DATA:
- You have access to the last 7 days of briefing data. Use this to identify trends, compare day-over-day changes, and provide richer analysis.
- When analyzing trends, reference specific data points from multiple days (e.g. "price moved from $X on Monday to $Y today, a Z% shift").
- You can compare prices across days, track sentiment shifts, identify narrative changes, and spot emerging patterns in institutional flows and technical signals.
- If the user asks "what happened this week" or "how has sentiment changed", draw on all available days.

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
  const etf = briefing.etf_flows;
  const etfLines: string[] = [];
  if (etf?.daily_net_flow_usd != null) etfLines.push(`ETF 24h net flow: $${(etf.daily_net_flow_usd / 1e6).toFixed(1)}M`);
  if (etf?.mtd_net_flow_usd != null) etfLines.push(`ETF MTD net flow: $${(etf.mtd_net_flow_usd / 1e6).toFixed(1)}M`);
  if (etf?.total_net_assets_usd != null) etfLines.push(`ETF total AUM: $${(etf.total_net_assets_usd / 1e9).toFixed(1)}B`);
  const flowsSection = etfLines.length > 0
    ? `ETF Flows:\n${etfLines.join("\n")}`
    : "";

  const instLines: string[] = [];
  if (flows?.summary && flows.summary !== "Data unavailable") instLines.push(flows.summary);
  if (flows?.notable_moves?.length) instLines.push(`Notable moves: ${flows.notable_moves.join("; ")}`);
  const instSection = instLines.length > 0
    ? `Institutional Activity:\n${instLines.join("\n")}`
    : "Institutional Activity: Not available";

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

${instSection}

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

function buildRecentBriefingSummary(briefing: BriefingJSON): string {
  const { market_snapshot: mkt } = briefing;
  const stories = briefing.top_stories
    .slice(0, 3)
    .map((s) => `- [${s.sentiment}] ${s.headline} (${s.source})`)
    .join("\n");

  const consensus = briefing.narrative_consensus;
  const tech = briefing.technical_signals;
  const fearGreed = briefing.fear_greed;
  const lookingAhead = (briefing.looking_ahead || "").split("\n\n")[0] || "";

  return `
${briefing.date}:
${briefing.one_line ? `Key insight: ${briefing.one_line}` : ""}
Price: $${mkt.price_usd.toLocaleString()} | 24h: ${mkt.change_24h_pct >= 0 ? "+" : ""}${mkt.change_24h_pct.toFixed(2)}% | 7d: ${mkt.change_7d_pct >= 0 ? "+" : ""}${mkt.change_7d_pct.toFixed(2)}%
${fearGreed ? `Fear & Greed: ${fearGreed.value} (${fearGreed.label})` : ""}
${consensus ? `Consensus: ${consensus.label} (score: ${consensus.score}/100)` : ""}
${tech ? `Technical: RSI ${tech.rsi_14} | ${tech.signal_summary}` : ""}
Top stories:
${stories || "No stories"}
${lookingAhead ? `Outlook: ${lookingAhead}` : ""}
`.trim();
}

function buildOlderBriefingSummary(briefing: BriefingJSON): string {
  const { market_snapshot: mkt } = briefing;
  const consensus = briefing.narrative_consensus;
  const topStory = briefing.top_stories[0];

  return `${briefing.date}: Price $${mkt.price_usd.toLocaleString()}, 24h ${mkt.change_24h_pct >= 0 ? "+" : ""}${mkt.change_24h_pct.toFixed(2)}%, Consensus: "${consensus?.label ?? "N/A"}" ${briefing.one_line ? `-- "${briefing.one_line}"` : ""}${topStory ? ` | Top: "${topStory.headline}"` : ""}`;
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

  const { message, email: bodyEmail, token: bodyToken, history } = body;

  // Resolve auth: cookie first, body fallback (for localStorage migration)
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  let email: string | undefined;
  let token: string | undefined;
  let authFromBody = false;

  if (sessionCookie) {
    try {
      const parsed = JSON.parse(sessionCookie);
      email = parsed.email;
      token = parsed.token;
    } catch { /* invalid cookie, fall through */ }
  }

  if (!token) {
    email = bodyEmail;
    token = bodyToken;
    authFromBody = true;
  }

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

  if (!token) {
    const noAuth = NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
    if (sessionCookie) clearSessionCookie(noAuth);
    return noAuth;
  }

  const supabase = createServiceClient();

  // Verify session token
  const { data: session, error: sessionError } = await supabase
    .from("verification_codes")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .eq("code", `session:${token}`)
    .eq("used", false)
    .gte("expires_at", new Date().toISOString())
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }

  if (!session) {
    const expired = NextResponse.json(
      { error: "Session expired. Please verify your email again." },
      { status: 401 }
    );
    clearSessionCookie(expired);
    return expired;
  }

  // Also confirm subscription is still active and check tier
  const { data: subscriber, error: subError } = await supabase
    .from("subscribers")
    .select("status, tier, name")
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

  if (subscriber.tier !== "pro") {
    return NextResponse.json(
      { error: "Pro subscription required to access AI Chat. Upgrade at /pricing" },
      { status: 403 }
    );
  }

  // Rate limit: 20 messages per 10 minutes per user
  if (!(await checkRateLimit(email.trim().toLowerCase()))) {
    return NextResponse.json(
      { error: "You've sent too many messages. Please wait a few minutes." },
      { status: 429 }
    );
  }

  // Auto-migrate: if auth came from body (localStorage), set the cookie
  const needsCookieMigration = authFromBody && !sessionCookie;

  const { data: briefingRows } = await supabase
    .from("daily_briefings")
    .select("date, content")
    .order("date", { ascending: false })
    .limit(7);

  let briefingContext = "No briefing data available.";

  if (briefingRows && briefingRows.length > 0) {
    const contextParts: string[] = [];

    // Today's briefing: full detail
    const today = (briefingRows[0] as DailyBriefingRow).content;
    contextParts.push(buildBriefingContext(today));

    // Days 1-2: medium summary
    const recentDays = briefingRows.slice(1, 3);
    if (recentDays.length > 0) {
      contextParts.push("\n\nRECENT BRIEFINGS:");
      for (const row of recentDays) {
        contextParts.push(buildRecentBriefingSummary((row as DailyBriefingRow).content));
      }
    }

    // Days 3-6: minimal summary
    const olderDays = briefingRows.slice(3, 7);
    if (olderDays.length > 0) {
      contextParts.push("\n\nHISTORICAL SNAPSHOT:");
      for (const row of olderDays) {
        contextParts.push(buildOlderBriefingSummary((row as DailyBriefingRow).content));
      }
    }

    briefingContext = contextParts.join("\n");
  }

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
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonResponse = NextResponse.json({ message: text });
    if (needsCookieMigration) setSessionCookie(jsonResponse, token, email, subscriber?.name);
    return jsonResponse;
  } catch (primaryError) {
    const err = primaryError as Error & { status?: number };
    const status = err.status ?? 0;
    const isRetryable = status === 429 || status >= 500;

    if (!isRetryable) {
      return NextResponse.json(
        { error: `AI service error: ${err.message}` },
        { status: 502 }
      );
    }

    // Fallback to Kie.ai on retryable errors
    const kieKey = process.env.KIE_API_KEY;
    if (!kieKey) {
      return NextResponse.json(
        { error: "AI service temporarily unavailable" },
        { status: 502 }
      );
    }

    try {
      const res = await fetch("https://api.kie.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${kieKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          max_tokens: 2048,
        }),
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: "AI service temporarily unavailable" },
          { status: 502 }
        );
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content ?? "";
      const fallbackResponse = NextResponse.json({ message: text });
      if (needsCookieMigration) setSessionCookie(fallbackResponse, token, email, subscriber?.name);
      return fallbackResponse;
    } catch {
      return NextResponse.json(
        { error: "AI service temporarily unavailable" },
        { status: 502 }
      );
    }
  }
}
