import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { COOKIE_NAME } from "@/lib/session";
import { getSubscriberTier } from "@/lib/tier";
import { getFoundingMemberStatus } from "@/lib/founding";
import { createServerClient } from "@/lib/supabase/server";
import { FEATURES } from "@/lib/constants";
import type { BriefingJSON, DailyBriefingRow } from "@/lib/types";

export const metadata: Metadata = {
  title: "Pricing | BTC Today",
  description:
    "Upgrade to BTC Today Pro for institutional-grade Bitcoin intelligence.",
  openGraph: {
    title: "Pricing | BTC Today",
    description:
      "Upgrade to BTC Today Pro for institutional-grade Bitcoin intelligence.",
    type: "website",
    siteName: "BTC Today",
  },
  twitter: {
    card: "summary",
    title: "Pricing | BTC Today",
    description:
      "Upgrade to BTC Today Pro for institutional-grade Bitcoin intelligence.",
  },
};

const FREE_FEATURES = FEATURES.map((f) => ({ label: f.label, included: f.freeIncluded }));
const PRO_FEATURES = FEATURES.map((f) => ({ label: f.label, included: true }));

export default async function PricingPage() {
  const { tier, email, isFoundingMember } = await getSubscriberTier();
  const isPro = tier === "pro";
  const founding = await getFoundingMemberStatus();
  const isFoundingActive = founding.isOfferActive;

  // Fetch subscriber count and latest briefing for social proof
  const supabase = await createServerClient();
  const subscriberCount = founding.activeCount;

  const { data: latestBriefing } = await supabase
    .from("daily_briefings")
    .select("content")
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const briefing = latestBriefing
    ? (latestBriefing as DailyBriefingRow).content
    : null;
  const sampleExpert = briefing?.expert_insights?.[0] ?? null;
  const sampleFlows = briefing?.institutional_flows?.summary ?? null;

  const monthlyUrl = process.env.NEXT_PUBLIC_WHOP_MONTHLY_URL;
  const annualUrl = process.env.NEXT_PUBLIC_WHOP_ANNUAL_URL;

  // Check if user has a session (for prefilling email in checkout)
  let sessionEmail: string | null = email;
  if (!sessionEmail) {
    try {
      const cookieStore = await cookies();
      const raw = cookieStore.get(COOKIE_NAME)?.value;
      if (raw) sessionEmail = JSON.parse(raw).email ?? null;
    } catch { /* no session */ }
  }

  // Append email to Whop checkout URLs if available
  const monthlyCheckout = monthlyUrl
    ? `${monthlyUrl}${monthlyUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(sessionEmail ?? "")}`
    : null;
  const annualCheckout = annualUrl
    ? `${annualUrl}${annualUrl.includes("?") ? "&" : "?"}email=${encodeURIComponent(sessionEmail ?? "")}`
    : null;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: isFoundingActive
      ? [
          {
            "@type": "Question",
            name: "What does \"Founding Member\" mean?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `The first ${founding.limit} subscribers get full Pro access. Free, permanently. No credit card, no catch.`,
            },
          },
          {
            "@type": "Question",
            name: "Will I lose access when the offer ends?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Founding member access is permanent. When we start charging, your Pro access stays the same.",
            },
          },
        ]
      : [
          {
            "@type": "Question",
            name: "What happens if I cancel?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "You keep Pro access until the end of your billing period. Then you revert to the free tier. No data is lost.",
            },
          },
          {
            "@type": "Question",
            name: "Can I switch between monthly and annual?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Yes. Email us at hello@btctoday.co and we'll adjust your plan. The annual plan saves you 30%.",
            },
          },
          {
            "@type": "Question",
            name: "Do I need a crypto wallet to subscribe?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Payment is in USD via credit card. No crypto required.",
            },
          },
        ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Header />
      <main className="pb-16">
        <Container>
          <div className="mt-10 text-center">
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">
              {isPro
                ? (isFoundingMember ? "You're a Founding Member" : "You're on Pro")
                : (isFoundingActive ? "Become a Founding Member" : "Upgrade to Pro")}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
              {isPro
                ? (isFoundingMember ? "You have lifetime Pro access as one of our first subscribers." : "You have full access to all features.")
                : isFoundingActive
                  ? "The first 100 subscribers get full Pro access. Free, permanently. No credit card required."
                  : "Unlock the daily email briefing, AI chat, PDF downloads, and complete archive."}
            </p>
            {!isPro && isFoundingActive && (
              <div className="mt-4 mx-auto max-w-xs">
                <div className="h-2 w-full rounded-full bg-[var(--color-border)]">
                  <div
                    className="h-2 rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${((founding.limit - founding.spotsLeft) / founding.limit) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--color-text-muted)] tracking-wide uppercase">
                  {founding.limit - founding.spotsLeft} of {founding.limit} founding spots claimed
                </p>
              </div>
            )}
            {!isPro && !isFoundingActive && (subscriberCount ?? 0) >= 10 && (
              <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)] tracking-wide uppercase">
                Joined by {subscriberCount}+ investors
              </p>
            )}
          </div>

          {/* Pricing cards */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 max-w-2xl mx-auto">

            {/* Free tier */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
              <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                Free
              </p>
              <p className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">
                $0
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                forever
              </p>

              <ul className="mt-6 space-y-2.5">
                {FREE_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 text-xs ${f.included ? "text-emerald-600" : "text-[var(--color-text-muted)]"}`}>
                      {f.included ? "✓" : "–"}
                    </span>
                    <span className={f.included ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"}>
                      {f.label}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro tier */}
            <div className="relative rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-surface)] p-6 ring-1 ring-[var(--color-accent)]/10">
              <div className="absolute -top-3 left-6 rounded-full bg-[var(--color-accent)] px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                {isFoundingActive ? "Founding Member" : "Pro"}
              </div>

              <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]">
                {isFoundingActive ? "Founding Member" : "Pro"}
              </p>
              {isFoundingActive ? (
                <>
                  <p className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">
                    $0
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    forever, for the first {founding.limit}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">
                    $59<span className="text-lg font-medium text-[var(--color-text-muted)]">/year</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    or $7/month
                  </p>
                </>
              )}

              <ul className="mt-6 space-y-2.5">
                {PRO_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-xs text-emerald-600">✓</span>
                    <span className="text-[var(--color-text-primary)]">{f.label}</span>
                  </li>
                ))}
              </ul>

              {isPro ? (
                <div className="mt-6 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-center">
                  <p className="text-sm font-medium text-emerald-700">
                    {isFoundingMember ? "Active - Founding Member" : "Active"}
                  </p>
                </div>
              ) : isFoundingActive ? (
                <div className="mt-6 flex flex-col gap-2">
                  <Link
                    href="/"
                    className="block rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
                  >
                    Sign up for free
                  </Link>
                  <p className="text-center text-xs text-[var(--color-text-muted)]">
                    No credit card required
                  </p>
                </div>
              ) : !sessionEmail ? (
                <div className="mt-6 flex flex-col gap-2">
                  <Link
                    href="/sign-in"
                    className="block rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
                  >
                    Sign in to subscribe
                  </Link>
                </div>
              ) : annualCheckout ? (
                <div className="mt-6 flex flex-col gap-2">
                  <a
                    href={annualCheckout}
                    className="block rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
                  >
                    Go Pro - $59/year (save 30%)
                  </a>
                  <a
                    href={monthlyCheckout ?? "#"}
                    className="block rounded-lg border border-[var(--color-accent)]/30 px-4 py-2.5 text-center text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
                  >
                    or $7/month
                  </a>
                </div>
              ) : (
                <div className="mt-6 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Coming soon
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Pro content sample */}
          {!isPro && (sampleExpert || sampleFlows) && (
            <div className="mt-12 max-w-2xl mx-auto">
              <p className="text-center font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-4">
                What Pro looks like
              </p>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 space-y-4">
                {sampleExpert && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-accent)] mb-1.5">
                      Expert Insight
                    </p>
                    <blockquote className="text-sm text-[var(--color-text-primary)] leading-relaxed italic">
                      &ldquo;{sampleExpert.quote_or_summary}&rdquo;
                    </blockquote>
                    <p className="mt-1.5 text-xs text-[var(--color-text-muted)]">
                      {sampleExpert.expert_name}{sampleExpert.role ? `, ${sampleExpert.role}` : ""}
                    </p>
                  </div>
                )}
                {sampleExpert && sampleFlows && sampleFlows !== "Data unavailable" && (
                  <div className="border-t border-[var(--color-border)] pt-4" />
                )}
                {sampleFlows && sampleFlows !== "Data unavailable" && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-[var(--color-accent)] mb-1.5">
                      Institutional Activity
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      {sampleFlows}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* FAQ */}
          <div className="mt-16 max-w-lg mx-auto">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] text-center mb-6">
              FAQ
            </h2>
            <div className="space-y-4">
              {isFoundingActive && (
                <>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">What does &ldquo;Founding Member&rdquo; mean?</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      The first {founding.limit} subscribers get full Pro access. Free, permanently. No credit card, no catch. Once all spots are claimed, new subscribers pay $7/month or $59/year.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Will I lose access when the offer ends?</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      No. Founding member access is permanent. When we start charging, your Pro access stays the same. No action needed.
                    </p>
                  </div>
                </>
              )}
              {!isFoundingActive && (
                <>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">What happens if I cancel?</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      You keep Pro access until the end of your billing period. Then you revert to the free tier. No data is lost.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Can I switch between monthly and annual?</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      Yes. Email us at hello@btctoday.co and we&apos;ll adjust your plan. The annual plan saves you 30%.
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">Do I need a crypto wallet to subscribe?</p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                      No. Payment is in USD via credit card. No crypto required.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {!isPro && (
            <div className="mt-10 text-center">
              <Link
                href="/"
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                Continue with free tier
              </Link>
            </div>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
