import Link from "next/link";
import { cookies } from "next/headers";
import { Container } from "./Container";
import { MobileNav } from "./MobileNav";
import { PulsingDot } from "@/components/ui/PulsingDot";
import { COOKIE_NAME } from "@/lib/session";

const navLinks = [
  { href: "/", label: "Briefing" },
  { href: "/chat", label: "Ask AI" },
  { href: "/archive", label: "Archive" },
] as const;

const sectionLinks = [
  { href: "#insight", label: "Insight" },
  { href: "#market", label: "Market" },
  { href: "#news", label: "News" },
  { href: "#stories", label: "Stories" },
  { href: "#deep-dive", label: "Deep Dive" },
  { href: "#outlook", label: "Outlook" },
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

export async function Header({ date }: { date?: string }) {
  let signedInEmail: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.email) signedInEmail = parsed.email;
    }
  } catch { /* no session */ }

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg-base)]/80 backdrop-blur-md">
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
        <nav className="hidden md:flex items-center gap-4">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {label}
            </Link>
          ))}
          <span className="h-3.5 w-px bg-[var(--color-border)]" />
          {sectionLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Right side: auth + date + mobile menu */}
        <div className="flex items-center gap-3">
          {date && (
            <time
              dateTime={date}
              className="hidden sm:block font-[family-name:var(--font-heading)] section-number text-[10px] font-medium text-[var(--color-text-muted)] tracking-[0.1em]"
            >
              {formatBriefingDate(date)}
            </time>
          )}
          {signedInEmail ? (
            <span className="hidden md:block text-[11px] font-medium text-[var(--color-text-muted)] truncate max-w-[120px]">
              {signedInEmail}
            </span>
          ) : (
            <Link
              href="/sign-in"
              className="hidden md:block text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            >
              Sign in
            </Link>
          )}
          <MobileNav signedInEmail={signedInEmail} />
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
