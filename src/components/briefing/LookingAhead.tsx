import { Card, CardContent } from "@/components/ui/card";
import { MotionCard } from "@/components/ui/MotionCard";

export function LookingAhead({ content }: { content: string }) {
  if (!content) return null;

  const paragraphs = content
    .split(/\n\n+/)
    .filter(Boolean)
    .slice(0, 4);

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
                  Next 24–72 hours
                </p>
              </div>
            </div>

            {/* Paragraphs */}
            <div className="space-y-4">
              {paragraphs.map((para, i) => {
                const firstDot = para.indexOf(". ");
                const lead = firstDot !== -1 ? para.slice(0, firstDot + 1) : para;
                const rest = firstDot !== -1 ? para.slice(firstDot + 2) : "";

                return (
                  <div
                    key={i}
                    className="border-l-[3px] border-l-[var(--color-accent)]/30 pl-4 py-0.5"
                  >
                    <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                      <span className="font-[family-name:var(--font-heading)] font-bold text-[var(--color-text-primary)]">
                        {lead}
                      </span>
                      {rest && ` ${rest}`}
                    </p>
                  </div>
                );
              })}
            </div>

          </div>
        </CardContent>
      </Card>
    </MotionCard>
  );
}
