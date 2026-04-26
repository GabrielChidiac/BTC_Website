import { ShareButtons } from "./ShareButtons";
import { NextBriefingCountdown } from "./NextBriefingCountdown";
import { TipPrompt } from "./TipPrompt";

interface BriefEndStateProps {
  shareUrl: string;
}

/**
 * Explicit end-of-brief state. Closes the 3-Minute Contract with a satisfying
 * "you are done" marker, a countdown to the next brief, share buttons so
 * finished readers become distribution nodes, and a tip prompt so engaged
 * readers can fund tomorrow's pipeline at the natural moment of completion.
 */
export function BriefEndState({ shareUrl }: BriefEndStateProps) {
  return (
    <section className="mt-10 flex flex-col items-center gap-4 py-6">
      <p className="font-[family-name:var(--font-heading)] text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">
        You are done. See you tomorrow.
      </p>
      <NextBriefingCountdown />
      <ShareButtons url={shareUrl} />
      <TipPrompt />
    </section>
  );
}
