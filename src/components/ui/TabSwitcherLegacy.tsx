"use client";

interface Tab {
  id: string;
  label: string;
}

interface TabSwitcherProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function TabSwitcher({ tabs, activeTab, onTabChange, className = "" }: TabSwitcherProps) {
  return (
    <div
      className={`inline-flex gap-1 rounded-lg bg-[var(--color-bg-base)] p-1 ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={`rounded-md px-3 py-1 text-[11px] font-[family-name:var(--font-heading)] font-semibold uppercase tracking-[0.08em] transition-colors cursor-pointer ${
              isActive
                ? "bg-[var(--color-bg-surface)] text-[var(--color-accent)] shadow-sm"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
