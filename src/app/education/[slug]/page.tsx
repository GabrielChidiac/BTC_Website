"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EDUCATION_ARTICLES } from "@/lib/education-data";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/layout/Container";

type Level = "beginner" | "intermediate" | "advanced";

const levels: { key: Level; label: string }[] = [
  { key: "beginner", label: "Beginner" },
  { key: "intermediate", label: "Intermediate" },
  { key: "advanced", label: "Advanced" },
];

export default function EducationArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [activeLevel, setActiveLevel] = useState<Level>("beginner");

  const article = EDUCATION_ARTICLES.find((a) => a.slug === slug);

  if (!article) {
    return (
      <>
        <Header />
        <main className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-[var(--color-text-secondary)]">Article not found.</p>
            <Link
              href="/education"
              className="mt-3 inline-block text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              Back to Education
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Find related articles (same category, excluding current)
  const related = EDUCATION_ARTICLES.filter(
    (a) => a.category === article.category && a.slug !== article.slug
  ).slice(0, 3);

  return (
    <>
      <Header />
      <main className="pb-10">
        <Container>
          {/* Back link */}
          <Link
            href="/education"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Education
          </Link>

          {/* Article header */}
          <div className="mt-6 mb-8">
            <span className="text-4xl">{article.icon}</span>
            <h1 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-bold text-[var(--color-text-primary)]">
              {article.title}
            </h1>
          </div>

          {/* Level tabs */}
          <div className="flex gap-1 rounded-lg bg-[var(--color-bg-elevated)] p-1 mb-6 max-w-sm">
            {levels.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveLevel(key)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 ${
                  activeLevel === key
                    ? "bg-[var(--color-accent)] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Article content */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6">
            <p className="text-base leading-relaxed text-[var(--color-text-primary)]">
              {article[activeLevel]}
            </p>
          </div>

          {/* Related articles */}
          {related.length > 0 && (
            <div className="mt-10">
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
                Related Topics
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {related.map((rel) => (
                  <Link
                    key={rel.slug}
                    href={`/education/${rel.slug}`}
                    className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 transition-colors hover:border-[var(--color-accent)]/30"
                  >
                    <span className="text-xl">{rel.icon}</span>
                    <p className="mt-1 font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                      {rel.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Chat CTA */}
          <div className="mt-10 rounded-xl border-l-4 border-l-[var(--color-accent)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-5 py-4">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Want to dive deeper?{" "}
              <Link
                href="/chat"
                className="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
              >
                Ask our AI assistant
              </Link>{" "}
              any follow-up questions about this topic.
            </p>
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
