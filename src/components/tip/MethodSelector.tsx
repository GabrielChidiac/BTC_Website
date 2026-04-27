"use client";

import { motion } from "framer-motion";

export type TipMethod = "lightning" | "card" | "onchain";

interface MethodSelectorProps {
  method: TipMethod;
  onChange: (m: TipMethod) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{
  value: TipMethod;
  label: string;
  hint?: string;
}> = [
  { value: "lightning", label: "Lightning", hint: "recommended" },
  { value: "card", label: "Card" },
  { value: "onchain", label: "On-chain BTC" },
];

export function MethodSelector({ method, onChange, disabled }: MethodSelectorProps) {
  return (
    <div className="mb-6">
      <div
        className="grid grid-cols-3 gap-1 rounded-xl border p-1"
        style={{
          backgroundColor: "var(--color-bg-base)",
          borderColor: "var(--color-border)",
        }}
        role="tablist"
        aria-label="Tip method"
      >
        {OPTIONS.map((opt) => {
          const selected = method === opt.value;
          return (
            <motion.button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={selected}
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              whileTap={{ scale: disabled ? 1 : 0.98 }}
              className="relative flex h-10 items-center justify-center gap-1.5 rounded-lg font-mono text-[11px] uppercase tracking-[0.16em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: selected
                  ? "var(--color-bg-surface)"
                  : "transparent",
                color: selected
                  ? "var(--color-text-primary)"
                  : "var(--color-text-muted)",
                boxShadow: selected
                  ? "0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 14px -8px rgba(0,0,0,0.18)"
                  : "none",
                transition:
                  "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
              }}
            >
              {opt.value === "lightning" && (
                <span aria-hidden="true" style={{ color: selected ? "var(--color-accent)" : "var(--color-text-muted)" }}>
                  <BoltGlyph />
                </span>
              )}
              <span>{opt.label}</span>
              {opt.hint && selected && (
                <span
                  className="hidden sm:inline font-mono text-[8px] uppercase tracking-[0.2em]"
                  style={{ color: "var(--color-accent)" }}
                >
                  {opt.hint}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>
      <p
        className="mt-2 text-[11px] leading-relaxed"
        style={{ color: "var(--color-text-muted)" }}
      >
        Lightning is the native rail. Card and on-chain are alternatives if you don&apos;t have a Lightning wallet.
      </p>
    </div>
  );
}

function BoltGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M8 1L2.5 7.5H6.5L5 13L11 6H7.5L9 1H8Z" fill="currentColor" />
    </svg>
  );
}
