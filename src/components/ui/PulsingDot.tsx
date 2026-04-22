"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

type DotVariant = "live" | "bullish" | "bearish";

const colorMap: Record<DotVariant, { dot: string; ring: string }> = {
  live: { dot: "bg-[var(--color-bullish)]", ring: "bg-[var(--color-bullish)]/70" },
  bullish: { dot: "bg-[var(--color-bullish)]", ring: "bg-[var(--color-bullish)]/70" },
  bearish: { dot: "bg-[var(--color-bearish)]", ring: "bg-[var(--color-bearish)]/70" },
};

interface PulsingDotProps {
  variant?: DotVariant;
  className?: string;
  size?: number;
}

export function PulsingDot({
  variant = "live",
  className,
  size = 8,
}: PulsingDotProps) {
  const colors = colorMap[variant];
  const reduced = useReducedMotion();

  return (
    <span
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Pulsing ring — hidden when reduced motion */}
      {!reduced && (
        <motion.span
          className={cn("absolute inset-0 rounded-full", colors.ring)}
          animate={{ scale: [1, 2.2], opacity: [0.5, 0] }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      )}
      {/* Solid dot */}
      <span
        className={cn("relative block rounded-full", colors.dot)}
        style={{ width: size, height: size }}
      />
    </span>
  );
}
