import Link from "next/link";
import { formatDisplayDate } from "@/lib/utils";
import { Container } from "./Container";
import { MobileNav } from "./MobileNav";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/experts", label: "Experts" },
  { href: "/chat", label: "Chat" },
  { href: "/archive", label: "Archive" },
] as const;

export function Header({ date }: { date?: string }) {
  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg-base)]/80 backdrop-blur-md">
      <Container className="flex h-14 items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight hover:opacity-80 transition-opacity shrink-0"
        >
          <span style={{ textShadow: "0 0 20px rgba(247, 147, 26, 0.15)" }}>
            BTC{" "}
            <span className="text-[var(--color-accent)]">Today</span>
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
              className="hidden sm:block text-sm text-[var(--color-text-muted)]"
            >
              {formatDisplayDate(date)}
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
