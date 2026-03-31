"use client";

import { useState, useRef, useEffect } from "react";

export function UserMenu({ displayName }: { displayName: string | null }) {
  const [open, setOpen] = useState(false);
  const [confirmUnsubscribe, setConfirmUnsubscribe] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmUnsubscribe(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setConfirmUnsubscribe(false);
      }
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.reload();
  }

  async function handleUnsubscribe() {
    setLoading(true);
    try {
      const res = await fetch("/api/unsubscribe", { method: "POST" });
      if (res.ok) {
        window.location.href = "/";
      }
    } catch {
      setLoading(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors whitespace-nowrap"
      >
        {displayName ?? "Account"}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className="transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path
            d="M2.5 3.75L5 6.25L7.5 3.75"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-1 shadow-lg shadow-black/5">
          {!confirmUnsubscribe ? (
            <>
              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors"
              >
                Log out
              </button>
              <div className="mx-2 my-1 h-px bg-[var(--color-border)]" />
              <button
                onClick={() => setConfirmUnsubscribe(true)}
                className="w-full px-3 py-2 text-left text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-bg-base)] transition-colors"
              >
                Unsubscribe
              </button>
            </>
          ) : (
            <div className="px-3 py-2">
              <p className="text-xs text-[var(--color-text-secondary)]">
                Stop all emails and delete your account?
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleUnsubscribe}
                  disabled={loading}
                  className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  {loading ? "..." : "Yes"}
                </button>
                <button
                  onClick={() => setConfirmUnsubscribe(false)}
                  className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
