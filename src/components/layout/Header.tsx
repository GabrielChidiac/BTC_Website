import Link from "next/link";
import { cookies } from "next/headers";
import { Container } from "./Container";
import { MobileNav } from "./MobileNav";
import { UserMenu } from "./UserMenu";
import { COOKIE_NAME } from "@/lib/session";
import { createServerClient } from "@/lib/supabase/server";

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
  { href: "#outlook", label: "What's Next" },
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
  let displayName: string | null = null;
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(COOKIE_NAME)?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.email) {
        signedInEmail = parsed.email;
        // Use name from cookie, otherwise fetch from DB
        let name: string | null = parsed.name ?? null;
        if (!name) {
          const supabase = await createServerClient();
          const { data: subscriber } = await supabase
            .from("subscribers")
            .select("name")
            .eq("email", parsed.email)
            .maybeSingle();
          name = subscriber?.name ?? null;
        }
        displayName = name?.split(/\s+/)[0] ?? null;
      }
    }
  } catch { /* no session */ }

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg-base)]/80 backdrop-blur-md">
      <Container wide className="flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-end gap-[3px] shrink-0">
          <svg
            viewBox="0 0 19 28"
            width="17"
            height="25"
            fill="var(--color-accent)"
            aria-hidden="true"
            className="drop-shadow-[0_0_10px_rgba(247,147,26,0.25)]"
          >
            {/* Bars — overlap into B body for seamless join */}
            <rect x="5" y="0" width="1.6" height="5" rx="0.8"/>
            <rect x="9.8" y="0" width="1.6" height="5" rx="0.8"/>
            <rect x="5" y="23" width="1.6" height="5" rx="0.8"/>
            <rect x="9.8" y="23" width="1.6" height="5" rx="0.8"/>
            {/* B body with counter cutouts */}
            <path fillRule="evenodd" d="
              M0 3 H8 C15.5 3 15.5 14 8 14 C16.5 14 16.5 25 8 25 H0 Z
              M3.5 6 H7 C12 6 12 11 7 11 H3.5 Z
              M3.5 17 H7.5 C13 17 13 22 7.5 22 H3.5 Z
            "/>
          </svg>
          <span className="font-[family-name:var(--font-heading)] text-[11px] font-bold tracking-[-0.04em] text-[var(--color-text-primary)] leading-none mb-[1px]">
            tdy
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4 shrink-0">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="whitespace-nowrap text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {label}
            </Link>
          ))}
          <span className="h-3.5 w-px bg-[var(--color-border)]" />
          {sectionLinks.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
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
            <div className="hidden md:flex items-center">
              <UserMenu displayName={displayName} />
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="hidden md:block text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            >
              Login
            </Link>
          )}
          <MobileNav signedInEmail={signedInEmail} displayName={displayName} />
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
