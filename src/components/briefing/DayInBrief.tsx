import type { MacroContext, CountdownEvent } from "@/lib/types";

/**
 * "The Day in 30 Seconds" — Axios-style scannable bullets.
 * Merges macro context + looking ahead + upcoming events into one tight section.
 */
export function DayInBrief({
  macro,
  lookingAhead,
  events,
}: {
  macro?: MacroContext;
  lookingAhead: string;
  events?: CountdownEvent[];
}) {
  if (!macro && !lookingAhead) return null;

  /* Extract the first sentence of each paragraph from lookingAhead for bullet format */
  const forwardBullets = lookingAhead
    ? lookingAhead
        .split(/\n\n+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((para) => {
          const firstDot = para.indexOf(". ");
          if (firstDot === -1) return { lead: para.trim(), rest: "" };
          return {
            lead: para.slice(0, firstDot + 1).trim(),
            rest: para.slice(firstDot + 2).trim(),
          };
        })
    : [];

  /* Upcoming events within 7 days */
  const urgentEvents = events
    ?.filter((e) => e.days_away !== null && e.days_away <= 7)
    .slice(0, 4) ?? [];

  return (
    <section className="mt-10">
      {/* Section label — editorial style */}
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-accent)]/30 to-transparent" />
        <h2 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-accent)]">
          The Day in 30 Seconds
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-[var(--color-accent)]/30 to-transparent" />
      </div>

      <div className="space-y-0">
        {/* Macro narrative — bold lead sentence, rest follows */}
        {macro?.narrative && (
          <BulletItem
            lead={extractLead(macro.narrative)}
            rest={extractRest(macro.narrative)}
            accent="orange"
          />
        )}

        {/* BTC correlation callout */}
        {macro?.btc_correlation_note && (
          <BulletItem
            lead={extractLead(macro.btc_correlation_note)}
            rest={extractRest(macro.btc_correlation_note)}
            accent="blue"
          />
        )}

        {/* Forward look bullets */}
        {forwardBullets.map((bullet, i) => (
          <BulletItem
            key={i}
            lead={bullet.lead}
            rest={bullet.rest}
            accent="orange"
          />
        ))}
      </div>

      {/* Upcoming events strip */}
      {urgentEvents.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {urgentEvents.map((event) => (
            <span
              key={event.name}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border ${
                event.days_away !== null && event.days_away <= 2
                  ? "bg-[var(--color-accent)]/8 border-[var(--color-accent)]/25 text-[var(--color-accent-hover)]"
                  : "bg-[var(--color-bg-elevated)] border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              <span className="font-[family-name:var(--font-heading)] font-bold">
                {event.days_away !== null ? `${event.days_away}d` : "TBD"}
              </span>
              <span className="opacity-40">|</span>
              {event.name}
            </span>
          ))}
        </div>
      )}

      {/* Key macro events */}
      {macro?.key_macro_events && macro.key_macro_events.length > 0 && urgentEvents.length === 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {macro.key_macro_events.map((event) => (
            <span
              key={event}
              className="inline-block rounded-md bg-[var(--color-bg-elevated)] border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-text-muted)]"
            >
              {event}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Bullet item ─────────────────────────────────────────────────────────── */

function BulletItem({
  lead,
  rest,
  accent,
}: {
  lead: string;
  rest: string;
  accent: "orange" | "blue";
}) {
  const borderColor =
    accent === "orange"
      ? "border-l-[var(--color-accent)]"
      : "border-l-[var(--color-blue)]";

  return (
    <div
      className={`border-l-[3px] ${borderColor} py-3 pl-4 transition-colors hover:bg-[var(--color-bg-surface)]/60`}
    >
      <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
        <span className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-primary)]">
          {lead}
        </span>
        {rest && ` ${rest}`}
      </p>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function extractLead(text: string): string {
  const firstDot = text.indexOf(". ");
  if (firstDot === -1) return text;
  return text.slice(0, firstDot + 1);
}

function extractRest(text: string): string {
  const firstDot = text.indexOf(". ");
  if (firstDot === -1) return "";
  return text.slice(firstDot + 2);
}
