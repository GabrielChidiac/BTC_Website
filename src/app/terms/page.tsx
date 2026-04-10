import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Terms of Service | BTC Today",
  description: "Terms and conditions for using BTC Today.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] py-12">
        <Container>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.04em] text-[var(--color-text-primary)] mb-2">
            Terms of Service
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mb-10">
            Last updated: April 10, 2026
          </p>

          <div className="space-y-8 max-w-2xl">
            <Section title="The service">
              <p>
                BTC Today provides AI-curated daily Bitcoin market intelligence delivered via a
                website and email. Content is generated using a combination of automated data
                collection, AI analysis, and third-party enrichment sources.
              </p>
            </Section>

            <Section title="Not financial advice">
              <p>
                Nothing on BTC Today constitutes financial, investment, tax, or legal advice.
                All content is for <strong>informational purposes only</strong>. Market data, analysis,
                expert commentary, and forward outlooks are provided as-is and should not be relied
                upon for making investment decisions. Always do your own research and consult a
                qualified financial advisor before acting on any information.
              </p>
            </Section>

            <Section title="Subscriptions and payments">
              <p>
                BTC Today offers a free tier and a paid Pro tier. Pro subscriptions are billed
                monthly ($7/month) or annually ($59/year) through <strong>Whop</strong>. You can
                cancel your Pro subscription at any time through Whop; access continues until
                the end of your billing period.
              </p>
            </Section>

            <Section title="AI chat">
              <p>
                The AI chat feature (Pro only) is powered by Anthropic&apos;s Claude. Responses are
                generated based on the latest briefing data and should be treated as AI-assisted
                analysis, not professional advice. Chat is rate-limited to ensure fair usage.
              </p>
            </Section>

            <Section title="Account and access">
              <ul className="list-disc pl-5 space-y-2">
                <li>You must provide a valid email address to subscribe</li>
                <li>You are responsible for maintaining access to your email for authentication</li>
                <li>We reserve the right to suspend accounts that abuse the service</li>
                <li>You can unsubscribe at any time from the menu or via email links</li>
              </ul>
            </Section>

            <Section title="Intellectual property">
              <p>
                All briefing content, design, and branding are owned by BTC Today. You may share
                excerpts with attribution but may not reproduce full briefings or systematically
                scrape content for redistribution.
              </p>
            </Section>

            <Section title="Limitation of liability">
              <p>
                BTC Today is provided &quot;as is&quot; without warranties of any kind. We are not
                liable for any losses or damages arising from your use of the service, reliance on
                its content, or decisions made based on information provided. Market data may be
                delayed or inaccurate.
              </p>
            </Section>

            <Section title="Changes to these terms">
              <p>
                We may update these terms from time to time. Continued use of the service after
                changes constitutes acceptance. For questions, contact us at{" "}
                <a
                  href="mailto:hello@btctoday.co"
                  className="text-[var(--color-accent)] hover:underline"
                >
                  hello@btctoday.co
                </a>.
              </p>
            </Section>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] mb-3">
        {title}
      </h2>
      <div className="text-sm leading-[1.8] text-[var(--color-text-secondary)] font-[family-name:var(--font-inter)] font-light">
        {children}
      </div>
    </section>
  );
}
