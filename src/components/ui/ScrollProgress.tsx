"use client";

import { useEffect, useState } from "react";

export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function onScroll() {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(h > 0 ? (window.scrollY / h) * 100 : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 z-[60] h-[2px] w-full pointer-events-none">
      <div
        className="h-full bg-[var(--color-accent)]"
        style={{
          width: `${progress}%`,
          boxShadow: "0 0 8px var(--color-accent-glow-strong)",
          transition: "width 100ms ease-out",
        }}
      />
    </div>
  );
}
