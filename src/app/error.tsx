"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg bg-[var(--color-bg-surface)] px-3 py-1.5 ring-1 ring-[var(--color-border)]">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
          <span className="font-[family-name:var(--font-heading)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Something went wrong
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-bold tracking-[-0.04em] leading-[1.1] text-[var(--color-text-primary)]">
          Unexpected error
        </h1>
        <p className="mt-3 font-[family-name:var(--font-body)] text-sm font-light leading-relaxed text-[var(--color-text-secondary)]">
          We hit a problem loading this page. Try refreshing, or come back in a moment.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex h-9 items-center rounded-lg bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--color-bg-surface)] px-4 text-sm font-medium text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)] hover:ring-[var(--color-accent)]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          >
            Today&apos;s briefing
          </a>
        </div>
      </div>
    </main>
  );
}
