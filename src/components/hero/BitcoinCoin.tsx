interface BitcoinCoinProps {
  size?: number;
  className?: string;
}

export function BitcoinCoin({ size = 120, className = "" }: BitcoinCoinProps) {
  return (
    <div
      className={`coin-spin pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, perspective: "400px" }}
    >
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        className="coin-face"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="coinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F7931A" />
            <stop offset="50%" stopColor="#FFB347" />
            <stop offset="100%" stopColor="#F7931A" />
          </linearGradient>
          <linearGradient id="coinEdge" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E8850F" />
            <stop offset="100%" stopColor="#C77810" />
          </linearGradient>
        </defs>

        {/* Outer ring */}
        <circle cx="60" cy="60" r="58" fill="url(#coinEdge)" />
        {/* Inner face */}
        <circle cx="60" cy="60" r="52" fill="url(#coinGrad)" />
        {/* Inner ring detail */}
        <circle cx="60" cy="60" r="46" fill="none" stroke="#E8850F" strokeWidth="1.5" opacity="0.4" />

        {/* ₿ symbol */}
        <text
          x="60"
          y="62"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="48"
          fontWeight="700"
          fontFamily="'Space Grotesk', system-ui, sans-serif"
          fill="#FFFFFF"
          opacity="0.95"
        >
          ₿
        </text>
      </svg>
    </div>
  );
}
