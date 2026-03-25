"use client";

export function ToggleSwitch({
  enabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  onToggle: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label ?? "Toggle"}
      onClick={onToggle}
      className="group flex items-center gap-2 focus-visible:outline-none"
    >
      {label && (
        <span className="text-xs font-medium text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text-secondary)]">
          {label}
        </span>
      )}
      <span
        className={`relative inline-flex h-[18px] w-[32px] shrink-0 items-center rounded-full transition-colors duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50 ${
          enabled
            ? "bg-[var(--color-accent)]"
            : "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]"
        }`}
      >
        <span
          className={`inline-block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
            enabled ? "translate-x-[15px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </button>
  );
}
