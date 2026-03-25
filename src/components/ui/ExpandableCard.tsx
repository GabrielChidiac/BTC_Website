"use client";

import { useState } from "react";

interface ExpandableCardProps {
  children: React.ReactNode;
  preview: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function ExpandableCard({
  children,
  preview,
  defaultOpen = false,
  className = "",
}: ExpandableCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`card-expandable rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] card-interactive ${className}`}
    >
      {/* Preview — always visible, toggles on click */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-5 sm:p-6 text-left cursor-pointer"
      >
        <div className="min-w-0 flex-1">{preview}</div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          className="expand-chevron mt-1 shrink-0 text-[var(--color-text-muted)]"
          data-open={open}
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Detail — expandable, content visible instantly */}
      <div className="expandable-content" data-open={open}>
        <div className="expandable-inner">
          <div className="px-5 pb-5 sm:px-6 sm:pb-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
