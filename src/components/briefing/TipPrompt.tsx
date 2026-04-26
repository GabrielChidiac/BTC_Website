import Link from "next/link";
import { TIP_PRESETS_SATS } from "@/lib/constants";

/**
 * Inline tip CTA shown at the end of every briefing, immediately below the
 * share buttons. Highest-attention moment on the page: the reader just
 * finished the brief and is at the natural exit. The four preset chips
 * deep-link into /tip with the amount pre-selected so the conversion path
 * is one tap away from the QR code.
 */
export function TipPrompt() {
  return (
    <div
      className="mt-2 w-full max-w-md rounded-2xl border p-5"
      style={{
        backgroundColor: "var(--color-bg-surface)",
        borderColor: "var(--color-border)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 24px -16px rgba(247,147,26,0.18)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--color-accent)",
            boxShadow: "0 0 0 4px var(--color-accent-glow)",
          }}
          aria-hidden="true"
        >
          <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
            <path d="M8 1L2.5 7.5H6.5L5 13L11 6H7.5L9 1H8Z" fill="#FFFFFF" />
          </svg>
        </span>
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--color-text-muted)" }}
        >
          Reader-funded
        </span>
      </div>

      <p
        className="mb-4 font-[family-name:var(--font-heading)] text-lg font-medium tracking-[-0.02em]"
        style={{ color: "var(--color-text-primary)" }}
      >
        Power tomorrow&apos;s brief.
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIP_PRESETS_SATS.map((preset) => (
          <Link
            key={preset}
            href={`/tip?amount=${preset}&source=site`}
            className="flex h-12 flex-col items-center justify-center rounded-lg border font-[family-name:var(--font-heading)] tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
            style={{
              backgroundColor: "var(--color-bg-base)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-primary)",
              transition:
                "background-color 150ms ease, border-color 150ms ease, color 150ms ease",
            }}
          >
            <span className="text-sm font-medium">
              {new Intl.NumberFormat("en-US").format(preset)}
            </span>
            <span
              className="font-mono text-[9px] uppercase tracking-[0.18em]"
              style={{ color: "var(--color-text-muted)" }}
            >
              sats
            </span>
          </Link>
        ))}
      </div>

      <Link
        href="/tip?source=site"
        className="font-mono text-[11px] uppercase tracking-[0.18em] underline-offset-4 hover:underline"
        style={{ color: "var(--color-accent)" }}
      >
        Other amount
      </Link>
    </div>
  );
}
