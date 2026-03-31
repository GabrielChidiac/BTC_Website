export default function ArchiveLoading() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="animate-pulse">
        <div className="h-6 w-32 rounded bg-[var(--color-border)]" />
        <div className="mt-2 h-3 w-48 rounded bg-[var(--color-border)]" />

        <div className="mt-8 space-y-3">
          {[...Array(7)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl bg-[var(--color-bg-surface)] p-4 ring-1 ring-[var(--color-border)]"
            >
              <div className="h-4 w-20 rounded bg-[var(--color-border)]" />
              <div className="h-4 flex-1 rounded bg-[var(--color-border)]" />
              <div className="h-4 w-16 rounded bg-[var(--color-border)]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
