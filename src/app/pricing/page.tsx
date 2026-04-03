import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { COOKIE_NAME } from "@/lib/session";
import { getSubscriberTier } from "@/lib/tier";

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

const FREE_FEATURES = [
  { label: "Daily market overview", included: true },
  { label: "Top stories with sentiment", included: true },
  { label: "BTC vs Everything comparisons", included: true },
  { label: "Regulatory & adoption signals", included: true },
  { label: "Weekly recap email", included: true },
  { label: "Daily email briefing", included: false },
  { label: "Institutional flows & ETF data", included: false },
  { label: "Technical signals (RSI, SMAs)", included: false },
  { label: "Network health & halving", included: false },
  { label: "Expert insights", included: false },
  { label: "Forward outlook", included: false },
  { label: "AI Chat assistant", included: false },
  { label: "PDF downloads", included: false },
  { label: "Full archive access", included: false },
];

const PRO_FEATURES = FREE_FEATURES.map((f) => ({ ...f, included: true }));

export default async function PricingPage() {
  const { tier, email } = await getSubscriberTier();
  const isPro = tier === "pro";

  const monthlyUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_MONTHLY_URL;
  const annualUrl = process.env.NEXT_PUBLIC_LEMONSQUEEZY_ANNUAL_URL;

  // Check if user has a session (for prefilling email in checkout)
  let sessionEmail: string | null = email;
  if (!sessionEmail) {
    try {
      const cookieStore = await cookies();
      const raw = cookieStore.get(COOKIE_NAME)?.value;
      if (raw) sessionEmail = JSON.parse(raw).email ?? null;
    } catch { /* no session */ }
  }

  // Append email to checkout URLs if available
  const monthlyCheckout = monthlyUrl
    ? `${monthlyUrl}${monthlyUrl.includes("?") ? "&" : "?"}checkout[email]=${encodeURIComponent(sessionEmail ?? "")}`
    : null;
  const annualCheckout = annualUrl
    ? `${annualUrl}${annualUrl.includes("?") ? "&" : "?"}checkout[email]=${encodeURIComponent(sessionEmail ?? "")}`
    : null;

  return (
    <>
      <Header />
      <main className="pb-16">
        <Container>
          <div className="mt-10 text-center">
            <h1 className="font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">
              {isPro ? "You're on Pro" : "Upgrade to Pro"}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-md mx-auto">
              {isPro
                ? "You have full access to all features."
                : "Unlock the daily email briefing, AI chat, PDF downloads, and complete archive."}
            </p>
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
                      {f.included ? "✓" : "—"}
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
                Pro
              </div>

              <p className="font-[family-name:var(--font-heading)] text-xs font-medium uppercase tracking-[0.12em] text-[var(--color-accent)]">
                Pro
              </p>
              <p className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-bold text-[var(--color-text-primary)]">
                $59<span className="text-lg font-medium text-[var(--color-text-muted)]">/year</span>
              </p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                or $7/month
              </p>

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
                  <p className="text-sm font-medium text-emerald-700">Active</p>
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
                    className="lemonsqueezy-button block rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 active:scale-[0.98]"
                  >
                    Go Pro — $59/year (save 30%)
                  </a>
                  <a
                    href={monthlyCheckout ?? "#"}
                    className="lemonsqueezy-button block rounded-lg border border-[var(--color-accent)]/30 px-4 py-2.5 text-center text-sm font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
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

          {/* FAQ */}
          <div className="mt-16 max-w-lg mx-auto">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] text-center mb-6">
              FAQ
            </h2>
            <div className="space-y-4">
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
