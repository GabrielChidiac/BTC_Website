"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

type RevealVariant = "up" | "left" | "scale";

const variantFrom: Record<RevealVariant, gsap.TweenVars> = {
  up: { y: 40, opacity: 0 },
  left: { x: -40, opacity: 0 },
  scale: { scale: 0.94, opacity: 0 },
};

const variantTo: Record<RevealVariant, gsap.TweenVars> = {
  up: { y: 0, opacity: 1 },
  left: { x: 0, opacity: 1 },
  scale: { scale: 1, opacity: 1 },
};

interface ScrollRevealProps {
  children: React.ReactNode;
  variant?: RevealVariant;
  delay?: number;
  duration?: number;
  className?: string;
}

export function ScrollReveal({
  children,
  variant = "up",
  delay = 0,
  duration = 0.7,
  className,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) {
      gsap.set(el, { clearProps: "all" });
      el.style.opacity = "1";
      return;
    }

    // Set initial hidden state via GSAP (not inline style)
    gsap.set(el, variantFrom[variant]);

    gsap.to(el, {
      ...variantTo[variant],
      duration,
      delay,
      ease: "power3.out",
      scrollTrigger: {
        trigger: el,
        start: "top 92%",
        once: true,
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === el) t.kill();
      });
    };
  }, [variant, delay, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
