"use client";

import { useState } from "react";
import type { MacroContext, CountdownEvent } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export function DayInBriefExpandable({
  macro,
  events,
}: {
  macro?: MacroContext;
  events?: CountdownEvent[];
}) {
  const [open, setOpen] = useState(false);

  if (!macro) return null;

  /* Build all bullet items */
  const bullets: { lead: string; rest: string; accent: "orange" | "blue" }[] = [];

  if (macro?.narrative) {
    bullets.push({ lead: extractLead(macro.narrative), rest: extractRest(macro.narrative), accent: "orange" });
  }
  if (macro?.btc_correlation_note) {
    bullets.push({ lead: extractLead(macro.btc_correlation_note), rest: extractRest(macro.btc_correlation_note), accent: "blue" });
  }

  /* Show first 2 bullets always, rest behind expand */
  const visibleBullets = bullets.slice(0, 2);
  const hiddenBullets = bullets.slice(2);

  /* Upcoming events within 7 days (exclude conferences/summits) */
  const BLOCKED = /conference|summit|expo|convention|meetup|hackathon/i;
  const urgentEvents = events
    ?.filter((e) => e.days_away !== null && e.days_away <= 7 && !BLOCKED.test(e.name) && !BLOCKED.test(e.description))
    .slice(0, 4) ?? [];

  const hasMore = hiddenBullets.length > 0 || urgentEvents.length > 0;

  return (
    <Card className="card-interactive h-full gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0">
      <CardContent className="p-5 sm:p-6">
        {/* Section label */}
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-[var(--color-accent)]/30 to-transparent" />
          <h2 className="font-[family-name:var(--font-heading)] text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-accent)]">
            The Day in 30 Seconds
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-[var(--color-accent)]/30 to-transparent" />
        </div>

        {/* Always-visible bullets */}
        <div className="space-y-0">
          {visibleBullets.map((bullet, i) => (
            <BulletItem key={i} lead={bullet.lead} rest={bullet.rest} accent={bullet.accent} />
          ))}
        </div>

        {/* Expandable section */}
        {hasMore && (
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleContent className="overflow-hidden transition-[height,opacity] data-[ending-style]:h-0 data-[starting-style]:h-0">
              <div className="space-y-0">
                {hiddenBullets.map((bullet, i) => (
                  <BulletItem key={i} lead={bullet.lead} rest={bullet.rest} accent={bullet.accent} />
                ))}
              </div>

              {/* Upcoming events strip */}
              {urgentEvents.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
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
              {!open && macro?.key_macro_events && macro.key_macro_events.length > 0 && urgentEvents.length === 0 && (
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
            </CollapsibleContent>

            {/* Toggle button */}
            <CollapsibleTrigger
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors cursor-pointer"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className={cn(
                  "transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)]",
                  open && "rotate-180"
                )}
              >
                <path
                  d="M4 6L8 10L12 6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {open ? "Show less" : `${hiddenBullets.length} more insight${hiddenBullets.length !== 1 ? "s" : ""}`}
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </CardContent>
    </Card>
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
    <div className={`border-l-[3px] ${borderColor} py-3 pl-4`}>
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
