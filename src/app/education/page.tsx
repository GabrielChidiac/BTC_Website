import Link from "next/link";
import type { Metadata } from "next";
import { EDUCATION_ARTICLES } from "@/lib/education-data";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Education | BTC Today",
  description: "Learn about Bitcoin at your own level. From beginner to advanced.",
};

const categoryColors: Record<string, string> = {
  Fundamentals: "bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20",
  Technical: "bg-blue-50 text-blue-700 border-blue-200",
  Security: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Investment: "bg-purple-50 text-purple-700 border-purple-200",
};

export default async function EducationPage() {
  const categories = [...new Set(EDUCATION_ARTICLES.map((a) => a.category))];

  return (
    <>
      <Header />
      <main className="pb-10">
        <Container>
          <div className="mt-8 mb-10">
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
              Learn Bitcoin
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-lg">
              Everything you need to understand Bitcoin, explained at your level.
            </p>
          </div>

          <section>
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-6">
              Knowledge Base
            </h2>

            {categories.map((category) => (
              <div key={category} className="mb-8">
                <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                  {category}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EDUCATION_ARTICLES.filter((a) => a.category === category).map((article) => (
                    <Link
                      key={article.slug}
                      href={`/education/${article.slug}`}
                      className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 transition-colors hover:border-[var(--color-accent)]/30"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl shrink-0">{article.icon}</span>
                        <div>
                          <p className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                            {article.title}
                          </p>
                          <span
                            className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
                              categoryColors[article.category] ?? categoryColors.Fundamentals
                            }`}
                          >
                            {article.category}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Chat CTA */}
          <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 text-center glow-card">
            <p className="font-[family-name:var(--font-heading)] text-base font-bold text-[var(--color-text-primary)]">
              Still have questions?
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Our AI assistant can explain anything about Bitcoin in plain English.
            </p>
            <Link
              href="/chat"
              className="mt-4 inline-block rounded-lg bg-[var(--color-accent)] px-6 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Ask the AI Assistant
            </Link>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
