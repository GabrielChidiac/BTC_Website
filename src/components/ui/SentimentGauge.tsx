"use client";

import { useEffect, useState } from "react";

interface SentimentGaugeProps {
  /** Score from -100 (extreme bearish) to +100 (extreme bullish) */
  score: number;
  label: string;
  className?: string;
}

function scoreColor(score: number): string {
  if (score >= 40) return "var(--color-accent)";
  if (score >= 10) return "#D97706";
  if (score > -10) return "var(--color-text-muted)";
  if (score > -40) return "#DC2626";
  return "#991B1B";
}

export function SentimentGauge({ score, label, className = "" }: SentimentGaugeProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 300);
    return () => clearTimeout(timer);
  }, []);

  // Map score (-100 to +100) to angle (-90deg to +90deg)
  const clampedScore = Math.max(-100, Math.min(100, score));
  const angle = (clampedScore / 100) * 90;

  // SVG arc: semicircle from left (-90deg) to right (+90deg)
  const cx = 60;
  const cy = 52;
  const r = 40;
  const strokeWidth = 5;

  // Arc background path (full semicircle)
  const arcBg = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Needle endpoint
  const needleAngle = ((angle - 90) * Math.PI) / 180; // offset so 0 = top
  const needleLen = r - 6;
  const nx = cx + needleLen * Math.cos(needleAngle);
  const ny = cy + needleLen * Math.sin(needleAngle);

  const color = scoreColor(score);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <svg width="120" height="68" viewBox="0 0 120 68" aria-hidden="true">
        {/* Track */}
        <path
          d={arcBg}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Colored arc fill — partial based on score */}
        <path
          d={arcBg}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${Math.PI * r}`}
          strokeDashoffset={animated ? `${Math.PI * r * (1 - (clampedScore + 100) / 200)}` : `${Math.PI * r}`}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.33, 1, 0.68, 1)" }}
          opacity={0.3}
        />

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={animated ? nx : cx}
          y2={animated ? ny : cy - needleLen}
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          style={{ transition: "all 1s cubic-bezier(0.33, 1, 0.68, 1)" }}
        />

        {/* Center dot */}
        <circle cx={cx} cy={cy} r="3" fill={color} />

        {/* Score text */}
        <text
          x={cx}
          y={cy + 2}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontSize="10"
          fontWeight="700"
          fontFamily="var(--font-heading)"
          fill="var(--color-text-primary)"
          className="tabular-nums"
        >
          {score > 0 ? `+${score}` : score}
        </text>
      </svg>

      <p
        className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
        style={{ color }}
      >
        {label}
      </p>
    </div>
  );
}
