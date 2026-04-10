import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

export const metadata: Metadata = {
  title: "Privacy Policy | BTC Today",
  description: "How BTC Today collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] py-12">
        <Container>
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-[-0.04em] text-[var(--color-text-primary)] mb-2">
            Privacy Policy
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mb-10">
            Last updated: April 10, 2026
          </p>

          <div className="space-y-8 max-w-2xl">
            <Section title="What we collect">
              <p>
                When you subscribe to BTC Today, we collect your <strong>email address</strong> and
                your <strong>first name</strong>. If you upgrade to Pro, payment is handled
                entirely by <strong>Whop</strong> -- we never see or store your card details.
              </p>
            </Section>

            <Section title="How we use your data">
              <ul className="list-disc pl-5 space-y-2">
                <li>Send you daily briefing emails and/or weekly recaps based on your subscription tier</li>
                <li>Authenticate your sessions via magic link (no passwords stored)</li>
                <li>Provide access to the AI chat feature (Pro subscribers)</li>
                <li>Improve the service based on aggregate, anonymized usage patterns</li>
              </ul>
            </Section>

            <Section title="Cookies">
              <p>
                We use a single session cookie (<code className="text-xs bg-[var(--color-bg-surface)] px-1.5 py-0.5 rounded">btc-session</code>)
                to keep you signed in for up to 30 days. It is httpOnly and secure in production. We do
                not use tracking cookies or third-party analytics.
              </p>
            </Section>

            <Section title="Third-party services">
              <p>
                We use trusted third-party providers to operate the service, including database hosting,
                email delivery, payment processing, AI chat, and website hosting. We only share the
                minimum data necessary for each service to function.
              </p>
            </Section>

            <Section title="Data retention">
              <p>
                Your account data is retained as long as your subscription is active. If you unsubscribe,
                your account is deactivated. You can request full deletion of your data at any time by
                emailing us.
              </p>
            </Section>

            <Section title="Your rights">
              <p>
                You can unsubscribe and deactivate your account at any time from the menu or via the
                unsubscribe link in any email. For data deletion requests or questions, contact us
                at{" "}
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
