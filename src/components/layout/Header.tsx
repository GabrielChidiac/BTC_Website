import Link from "next/link";
import { Container } from "./Container";
import { MobileNav } from "./MobileNav";
import { PulsingDot } from "@/components/ui/PulsingDot";

const navLinks = [
  { href: "/", label: "Briefing" },
  { href: "/chat", label: "Ask AI" },
  { href: "/archive", label: "Archive" },
] as const;

function formatBriefingDate(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z")
    .toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .toUpperCase();
}

export function Header({ date }: { date?: string }) {
  return (
    <header className="sticky top-[36px] z-50 bg-[var(--color-bg-base)]/80 backdrop-blur-md">
      <Container wide className="flex h-14 items-center justify-between">
        {/* Logo — intelligence report framing */}
        <Link
          href="/"
          className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0"
        >
          <span
            className="font-[family-name:var(--font-heading)] text-lg font-bold tracking-tight"
            style={{ textShadow: "0 0 20px rgba(247, 147, 26, 0.15)" }}
          >
            BTC{" "}
            <span className="text-[var(--color-accent)]">Today</span>
          </span>
          <span className="hidden sm:block h-3.5 w-px bg-[var(--color-border)]" />
          <span className="hidden sm:flex items-center gap-1.5 font-[family-name:var(--font-heading)] section-number text-[10px] font-medium text-[var(--color-text-muted)] tracking-[0.12em]">
            <PulsingDot variant="live" size={6} />
            DAILY INTELLIGENCE BRIEFING
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side: date + mobile menu */}
        <div className="flex items-center gap-3">
          {date && (
            <time
              dateTime={date}
              className="hidden sm:block font-[family-name:var(--font-heading)] section-number text-[10px] font-medium text-[var(--color-text-muted)] tracking-[0.1em]"
            >
              {formatBriefingDate(date)}
            </time>
          )}
          <MobileNav />
        </div>
      </Container>
      {/* Glow border */}
      <div
        className="h-px w-full"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(247, 147, 26, 0.2) 50%, transparent 100%)",
        }}
      />
    </header>
  );
}
