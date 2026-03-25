"use client";

import { useEffect, useRef } from "react";

type RevealVariant = "up" | "left" | "scale";

const variantClass: Record<RevealVariant, string> = {
  up: "reveal",
  left: "reveal-left",
  scale: "reveal-scale",
};

export function RevealOnScroll({
  children,
  delay = 0,
  variant = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  variant?: RevealVariant;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cls = variantClass[variant];

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      el.classList.remove(cls);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (delay > 0) {
            setTimeout(() => el.classList.add("visible"), delay);
          } else {
            el.classList.add("visible");
          }
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay, cls]);

  return (
    <div ref={ref} className={cls}>
      {children}
    </div>
  );
}
