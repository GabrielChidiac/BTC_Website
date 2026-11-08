import Link from "next/link";
import type { Metadata } from "next";
import { getSubscriberTier } from "@/lib/tier";
import { getFoundingMemberStatus } from "@/lib/founding";
import { getArchiveIndex } from "@/lib/briefings";
import { safeJsonLd } from "@/lib/json-ld";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";
import { ArchiveList, type ArchiveEntry } from "@/components/archive/ArchiveList";

export const metadata: Metadata = {
  title: "Bitcoin Daily Intelligence Archive | BTC Today",
  description:
    "Browse AI-curated daily Bitcoin briefings with market analysis, institutional flows, technical signals, and expert insights.",
  openGraph: {
    title: "Bitcoin Daily Intelligence Archive | BTC Today",
    description:
      "Browse AI-curated daily Bitcoin briefings with market analysis, institutional flows, technical signals, and expert insights.",
    type: "website",
    siteName: "BTC Today",
    url: "https://www.btctoday.co/archive",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bitcoin Daily Intelligence Archive | BTC Today",
    description:
      "Browse AI-curated daily Bitcoin briefings with market analysis, institutional flows, technical signals, and expert insights.",
  },
  alternates: {
    canonical: "/archive",
  },
};

export default async function ArchivePage() {
  const { tier } = await getSubscriberTier();
  const isPro = tier === "pro";
  const founding = isPro ? null : await getFoundingMemberStatus();
  const isFoundingActive = founding?.isOfferActive ?? false;

  const index = await getArchiveIndex();

  // Free users only see the last 7 days
  let entries: ArchiveEntry[] = index;
  if (!isPro) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 7);
    const cutoffDate = cutoff.toISOString().split("T")[0];
    entries = index.filter((row) => row.date >= cutoffDate);
  }

  const baseUrl = "https://www.btctoday.co";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "BTC Today", item: baseUrl },
              { "@type": "ListItem", position: 2, name: "Archive", item: `${baseUrl}/archive` },
            ],
          }),
        }}
      />
      <Header />
      <main className="pb-10">
        <Container>
          {/* Page title */}
          <div className="mt-8 mb-8">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
              Archive
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {entries.length} briefing{entries.length !== 1 ? "s" : ""}{!isPro && " · Last 7 days"}
            </p>
          </div>

          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-16">
              <p className="text-sm text-[var(--color-text-secondary)]">
                No briefings yet. The first one publishes at 2 AM CET.
              </p>
              <Link
                href="/"
                className="mt-4 text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                Back to home
              </Link>
            </div>
          ) : (
            <>
              {!isPro && (
                <div className="mb-6 flex items-center gap-3 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-3">
                  <p className="flex-1 text-sm text-[var(--color-text-secondary)]">
                    {isFoundingActive
                      ? "Founding members get full archive access, free"
                      : "Unlock the full archive with Pro"}
                  </p>
                  <Link
                    href={isFoundingActive ? "/" : "/pricing"}
                    className="shrink-0 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                  >
                    {isFoundingActive ? "Claim your spot" : "Go Pro - $59/yr"}
                  </Link>
                </div>
              )}

              <ArchiveList entries={entries} />
            </>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}
