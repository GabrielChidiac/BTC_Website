"use client";

import { useState } from "react";

export function UnsubscribeButton() {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

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

  if (confirming) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--color-text-muted)]">Stop all emails?</span>
        <button
          onClick={handleUnsubscribe}
          disabled={loading}
          className="text-xs font-medium text-[var(--color-bearish)] hover:text-[var(--color-bearish)]/80 transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "Yes, unsubscribe"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
    >
      Unsubscribe
    </button>
  );
}
