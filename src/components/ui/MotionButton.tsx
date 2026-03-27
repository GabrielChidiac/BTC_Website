"use client";

import { motion, useReducedMotion } from "framer-motion";

interface MotionButtonProps {
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: () => void;
}

export function MotionButton({
  children,
  className,
  type = "button",
  disabled,
  onClick,
}: MotionButtonProps) {
  const reduced = useReducedMotion();
  const noAnim = reduced || disabled;

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
      whileHover={noAnim ? undefined : { scale: 1.03, y: -1 }}
      whileTap={noAnim ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
    >
      {children}
    </motion.button>
  );
}
