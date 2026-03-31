"use client";

import { useState, useEffect } from "react";

function getTimeUntilNextBriefing(): { hours: number; minutes: number } {
  const now = new Date();
  const target = new Date(now);
  target.setUTCHours(1, 0, 0, 0);

  if (now >= target) {
    target.setUTCDate(target.getUTCDate() + 1);
  }

  const diffMs = target.getTime() - now.getTime();
  const totalMinutes = Math.floor(diffMs / 60_000);
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

export function NextBriefingCountdown() {
  const [time, setTime] = useState<{
    hours: number;
    minutes: number;
  } | null>(null);

  useEffect(() => {
    setTime(getTimeUntilNextBriefing());
    const id = setInterval(() => setTime(getTimeUntilNextBriefing()), 60_000);
    return () => clearInterval(id);
  }, []);

  // SSR / initial render: static fallback to avoid hydration mismatch
  if (!time) {
    return (
      <p className="text-xs text-[var(--color-accent)]">
        Next briefing: 2 AM CET
      </p>
    );
  }

  return (
    <p className="text-xs text-[var(--color-accent)] tabular-nums">
      Next briefing in {time.hours}h {time.minutes.toString().padStart(2, "0")}m
    </p>
  );
}
