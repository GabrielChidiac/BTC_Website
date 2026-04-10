"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MotionCard } from "@/components/ui/MotionCard";

export function LookingAhead({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!content) return null;

  const metaPattern = /\b(my instructions|critical constraint|let me deliver|briefing you['']ve provided|I appreciate the.*briefing|I need to flag|plain text format|three.paragraph editorial)\b/i;

  const paragraphs = content
    .split(/\n\n+/)
    .filter((p) => !p.match(/^#{1,6}\s/))
    .filter((p) => !metaPattern.test(p))
    .filter(Boolean)
    .slice(0, 4);

  if (paragraphs.length === 0) return null;

  const lead = paragraphs[0];
  const body = paragraphs.slice(1);

  return (
    <MotionCard>
      <Card className="gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0 overflow-hidden">
        <CardContent className="p-0">
          {/* Accent top bar */}
          <div className="h-[3px] bg-gradient-to-r from-[var(--color-accent)] via-[var(--color-accent)]/60 to-transparent" />

          <div className="p-5 sm:p-6">
            {/* Section header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent)]/8 ring-1 ring-[var(--color-accent)]/15">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--color-accent)]">
                  <path d="M8 2v12M8 2l3 3M8 2L5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-sm font-bold text-[var(--color-text-primary)]">
                  Forward Outlook
                </h3>
                <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-medium">
                  Next 24-72 hours
                </p>
              </div>
            </div>

            {/* Lead paragraph */}
            <p className="text-[15px] sm:text-base leading-[1.75] text-[var(--color-text-primary)] font-[family-name:var(--font-inter)] font-light">
              {lead}
            </p>

            {/* Collapsible body */}
            {body.length > 0 && (
              <>
                {expanded && (
                  <div className="mt-5 pt-5 border-t border-[var(--color-border)]/60 space-y-4">
                    {body.map((para, i) => (
                      <p
                        key={i}
                        className="text-sm leading-[1.8] text-[var(--color-text-secondary)] font-[family-name:var(--font-inter)] font-light"
                      >
                        {para}
                      </p>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-4 flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors cursor-pointer"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                    className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {expanded ? "Show less" : `${body.length} more insight${body.length > 1 ? "s" : ""}`}
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </MotionCard>
  );
}
