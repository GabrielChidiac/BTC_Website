import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { ChatContent } from "./ChatContent";
import { COOKIE_NAME } from "@/lib/session";
import { getSubscriberTier } from "@/lib/tier";
import { createServerClient } from "@/lib/supabase/server";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Ask AI | BTC Today",
  description: "Ask questions about today's Bitcoin market data, powered by AI.",
  robots: { index: false, follow: true },
};

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; email?: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME)?.value;

  let initialSession: { email: string } | null = null;
  if (sessionCookie) {
    try {
      const { email } = JSON.parse(sessionCookie);
      if (email) initialSession = { email };
    } catch { /* invalid cookie */ }
  }

  // Allow magic link params through (they'll be verified client-side)
  const params = await searchParams;
  const hasMagicLink = params.token && params.email;

  // No session and no magic link → redirect to login
  if (!initialSession && !hasMagicLink) {
    redirect("/sign-in");
  }

  // Pro tier required for chat — free users go to pricing
  if (initialSession && !hasMagicLink) {
    const { tier } = await getSubscriberTier();
    if (tier !== "pro") {
      redirect("/pricing");
    }
  }

  // Generate dynamic starter prompts from today's briefing
  const starters = await generateStarters();

  return (
    <>
      <Header />
      <ChatContent initialSession={initialSession} starters={starters} />
    </>
  );
}

const DEFAULT_STARTERS = [
  "What's driving Bitcoin's price action today?",
  "Summarize today's institutional flows and ETF data",
  "What are the key macro catalysts to watch this week?",
  "What are experts saying about Bitcoin right now?",
];

async function generateStarters(): Promise<string[]> {
  try {
    const supabase = await createServerClient();
    const { data: row } = await supabase
      .from("daily_briefings")
      .select("content")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return DEFAULT_STARTERS;

    const b = (row as DailyBriefingRow).content;
    const prompts: string[] = [];

    // Price movement prompt
    const pct = b.market_snapshot.change_24h_pct;
    if (pct > 3) {
      prompts.push(`BTC is up ${pct.toFixed(1)}% today. What's fueling this move?`);
    } else if (pct < -3) {
      prompts.push(`BTC dropped ${Math.abs(pct).toFixed(1)}% today. What triggered the selloff?`);
    } else {
      prompts.push("Walk me through today's market action");
    }

    // ETF flows prompt
    const etf = b.etf_flows;
    if (etf?.daily_net_flow_usd != null) {
      const flowM = etf.daily_net_flow_usd / 1e6;
      const sign = flowM >= 0 ? "+" : "";
      prompts.push(`ETF flows were ${sign}$${Math.abs(flowM).toFixed(0)}M today. What does this signal?`);
    }

    // Top story prompt
    if (b.top_stories?.[0]) {
      const headline = b.top_stories[0].headline;
      const short = headline.length > 60 ? headline.slice(0, 57) + "..." : headline;
      prompts.push(`What are the implications of "${short}"?`);
    }

    // Consensus prompt
    if (b.narrative_consensus?.label) {
      prompts.push(`The consensus is "${b.narrative_consensus.label}". Do you agree?`);
    }

    // Always add a forward-looking question
    prompts.push("What should I watch for this week?");

    // Return first 4 unique prompts
    return prompts.slice(0, 4);
  } catch {
    return DEFAULT_STARTERS;
  }
}
