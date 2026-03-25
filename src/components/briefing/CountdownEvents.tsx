import type { CountdownEvent } from "@/lib/types";

export function CountdownEvents({
  events,
  compact = false,
}: {
  events: CountdownEvent[];
  compact?: boolean;
}) {
  if (!events || events.length === 0) return null;

  if (compact) {
    const shown = events.slice(0, 5);
    return (
      <section className="mt-6">
        <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5">
          On the radar
        </p>
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {shown.map((event) => (
            <div
              key={event.name}
              className={`flex shrink-0 items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2.5 transition-colors hover:border-[var(--color-accent)]/40${event.days_away !== null && event.days_away <= 3 ? " pulse-urgent" : ""}`}
            >
              <div className="flex flex-col items-center justify-center">
                <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-accent)] leading-none">
                  {event.days_away !== null ? event.days_away : "?"}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mt-0.5">
                  {event.days_away !== null
                    ? event.days_away === 1
                      ? "day"
                      : "days"
                    : "TBD"}
                </span>
              </div>
              <div className="h-6 w-px bg-[var(--color-border)]" />
              <span className="text-xs font-medium text-[var(--color-text-secondary)] max-w-[160px] truncate">
                {event.name}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-text-primary)] mb-4">
        Upcoming Events
      </h2>

      <div className="space-y-3">
        {events.map((event) => (
          <div
            key={event.name}
            className="flex items-center gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4"
          >
            {/* Days badge */}
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
              <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-[var(--color-accent)] leading-none">
                {event.days_away !== null ? event.days_away : "?"}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
                {event.days_away !== null ? "days" : "TBD"}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)]">
                {event.name}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-secondary)] line-clamp-2">
                {event.description}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {event.date}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
