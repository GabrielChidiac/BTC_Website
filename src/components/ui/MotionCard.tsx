"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

interface MotionCardProps {
  children: React.ReactNode;
  className?: string;
  /** Lift distance in px on hover (default 3) */
  lift?: number;
}

export function MotionCard({
  children,
  className,
  lift = 3,
}: MotionCardProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={cn("will-change-transform", className)}
      whileHover={
        reduced
          ? undefined
          : {
              y: -lift,
              transition: { type: "spring", stiffness: 400, damping: 25 },
            }
      }
    >
      {children}
    </motion.div>
  );
}
