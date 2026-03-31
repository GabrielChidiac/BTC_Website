export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="animate-pulse space-y-6">
        {/* Hero skeleton */}
        <div className="rounded-2xl bg-[var(--color-bg-surface)] p-6 ring-1 ring-[var(--color-border)]">
          <div className="h-3 w-24 rounded bg-[var(--color-border)]" />
          <div className="mt-4 h-8 w-3/4 rounded bg-[var(--color-border)]" />
          <div className="mt-3 h-4 w-1/2 rounded bg-[var(--color-border)]" />
          <div className="mt-6 flex gap-4">
            <div className="h-16 w-1/3 rounded-lg bg-[var(--color-border)]" />
            <div className="h-16 w-1/3 rounded-lg bg-[var(--color-border)]" />
            <div className="h-16 w-1/3 rounded-lg bg-[var(--color-border)]" />
          </div>
        </div>

        {/* Cards skeleton */}
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl bg-[var(--color-bg-surface)] p-5 ring-1 ring-[var(--color-border)]"
          >
            <div className="h-3 w-20 rounded bg-[var(--color-border)]" />
            <div className="mt-3 h-4 w-full rounded bg-[var(--color-border)]" />
            <div className="mt-2 h-4 w-5/6 rounded bg-[var(--color-border)]" />
            <div className="mt-2 h-4 w-2/3 rounded bg-[var(--color-border)]" />
          </div>
        ))}
      </div>
    </main>
  );
}
