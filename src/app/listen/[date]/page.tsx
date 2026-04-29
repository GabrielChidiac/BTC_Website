import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createServerClient, createServiceClient } from "@/lib/supabase/server";
import { COOKIE_NAME } from "@/lib/session";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";
import { formatDisplayDate, formatReadTime } from "@/lib/utils";
import { AudioPlayer } from "@/components/player/AudioPlayer";

export const revalidate = false;

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/**
 * Resolve a Pro subscriber email from either an existing session cookie OR
 * a magic link token carried on the URL. Mirrors the dual-auth pattern used
 * by /pdf/[date]/route.ts and /api/audio/[date]/route.ts so that Pro
 * subscribers clicking the Listen button from an email always auth cleanly,
 * even in an incognito browser with no prior session.
 *
 * Returns the subscriber's email when they are an active Pro subscriber,
 * otherwise null (caller should redirect to /pricing).
 */
async function resolveProSubscriberEmail(
  queryToken: string | undefined,
  queryEmail: string | undefined
): Promise<string | null> {
  const supabase = createServiceClient();

  // ── Auth path 1: Session cookie ──────────────────────────────────
  let email: string | undefined;

  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { email?: string; token?: string };
      const cookieEmail = parsed.email?.trim().toLowerCase();
      const cookieToken = parsed.token;

      if (cookieEmail && cookieToken) {
        const { data: session } = await supabase
          .from("verification_codes")
          .select("id")
          .eq("email", cookieEmail)
          .eq("code", `session:${cookieToken}`)
          .eq("used", false)
          .gte("expires_at", new Date().toISOString())
          .limit(1)
          .maybeSingle();

        if (session) email = cookieEmail;
      }
    } catch { /* invalid cookie — fall through to magic token path */ }
  }

  // ── Auth path 2: Magic link token via query params ──────────────
  if (!email) {
    const token = queryToken?.trim();
    const emailParam = queryEmail?.trim().toLowerCase();

    if (token && emailParam && token.length >= 32) {
      const { data: magicToken } = await supabase
        .from("verification_codes")
        .select("id")
        .eq("email", emailParam)
        .eq("code", `magic:${token}`)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();

      if (magicToken) email = emailParam;
    }
  }

  if (!email) return null;

  // ── Verify active Pro subscription ──────────────────────────────
  const { data: subscriber } = await supabase
    .from("subscribers")
    .select("tier, status")
    .eq("email", email)
    .maybeSingle();

  if (!subscriber || subscriber.status !== "active" || subscriber.tier !== "pro") {
    return null;
  }

  return email;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return { title: "Not Found | BTC Today" };
  return {
    title: `Audio Brief | ${formatDisplayDate(date)} | BTC Today`,
    description: "The 4-minute Bitcoin briefing you listen to on your commute.",
    robots: { index: false, follow: false },
  };
}

interface AudioPageProps {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
}

export default async function ListenPage({ params, searchParams }: AudioPageProps) {
  const { date } = await params;
  const { token, email: queryEmail } = await searchParams;

  if (!isValidDate(date)) notFound();

  // Gate the page to active Pro subscribers. Supports BOTH a normal session
  // cookie (website browsing) AND a magic link token carried on the URL
  // (Pro subscribers clicking the Listen button from their daily email in an
  // incognito browser with no prior session). Non-Pro → redirect to /pricing.
  const proEmail = await resolveProSubscriberEmail(token, queryEmail);
  if (!proEmail) {
    redirect("/pricing");
  }

  // Fetch the briefing so we can display read-time, hero lines, and duration.
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("daily_briefings")
    .select("date, content")
    .eq("date", date)
    .maybeSingle();

  if (!data) notFound();
  const briefing: BriefingJSON = (data as DailyBriefingRow).content;

  // If audio generation failed for this date, show a graceful fallback.
  if (!briefing.audio_url) {
    return (
      <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
        <p className="font-[family-name:var(--font-heading)] text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
          {formatDisplayDate(date)}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
          Audio unavailable for this date
        </h1>
        <p className="mt-3 max-w-sm text-sm text-[var(--color-text-secondary)]">
          The audio brief was not generated for this briefing. You can read the full written brief instead.
        </p>
        <Link
          href={`/archive/${date}`}
          className="mt-6 inline-flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-2.5 font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-primary)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-accent)] transition-colors"
        >
          Read the full brief
        </Link>
      </main>
    );
  }

  // Build the audio source URL. When the page is reached from the email link
  // with a magic token, forward it to the audio route so the route can
  // authenticate the stream request even if the browser has no session yet.
  const audioSrc = token && queryEmail
    ? `/api/audio/${date}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(queryEmail)}`
    : `/api/audio/${date}`;

  return (
    <main className="flex min-h-[85vh] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <header className="mb-10 text-center">
          <p className="font-[family-name:var(--font-heading)] text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
            BTC Today
          </p>
          <h1 className="mt-2 font-[family-name:var(--font-heading)] text-2xl sm:text-3xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)]">
            The Morning Brief
          </h1>
          {briefing.audio_duration_seconds ? (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {formatReadTime(briefing.audio_duration_seconds)} listen
            </p>
          ) : null}
        </header>

        <AudioPlayer
          src={audioSrc}
          durationSeconds={briefing.audio_duration_seconds}
          dateLabel={formatDisplayDate(date)}
        />

        {briefing.hero_three_lines && (
          <section className="mt-12 space-y-6">
            <HeroLine label="The Move" text={briefing.hero_three_lines.move} />
            <HeroLine label="The Signal" text={briefing.hero_three_lines.signal} />
            <HeroLine label="The Watch" text={briefing.hero_three_lines.watch} />
          </section>
        )}

        <div className="mt-12 flex justify-center">
          <Link
            href={`/archive/${date}`}
            className="font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            Read the full brief
          </Link>
        </div>
      </div>
    </main>
  );
}

function HeroLine({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="font-[family-name:var(--font-heading)] text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-accent)] mb-1.5">
        {label}
      </p>
      <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
        {text}
      </p>
    </div>
  );
}
