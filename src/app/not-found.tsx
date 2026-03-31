import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Block number aesthetic */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg bg-[var(--color-bg-surface)] px-3 py-1.5 ring-1 ring-[var(--color-border)]">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
          <span className="font-[family-name:var(--font-heading)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Block not found
          </span>
        </div>

        <h1 className="font-[family-name:var(--font-heading)] text-6xl font-bold tracking-[-0.04em] leading-[1.1] text-[var(--color-text-primary)]">
          404
        </h1>
        <p className="mt-3 font-[family-name:var(--font-body)] text-sm font-light leading-relaxed text-[var(--color-text-secondary)]">
          This page doesn&apos;t exist or has been moved.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--color-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          >
            Today&apos;s briefing
          </Link>
          <Link
            href="/archive"
            className="inline-flex h-9 items-center rounded-lg bg-[var(--color-bg-surface)] px-4 text-sm font-medium text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)] hover:ring-[var(--color-accent)]/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
          >
            Archive
          </Link>
        </div>
      </div>
    </main>
  );
}
