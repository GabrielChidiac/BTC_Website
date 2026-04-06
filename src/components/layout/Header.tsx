import Link from "next/link";
import { Container } from "./Container";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";
import { UserMenu } from "./UserMenu";
import { getSubscriberTier } from "@/lib/tier";
import { formatBriefingDate } from "@/lib/utils";

export async function Header({ date }: { date?: string }) {
  const { tier, email: signedInEmail, name } = await getSubscriberTier();
  const firstName = name?.split(/\s+/)[0] ?? null;
  const displayName = firstName ?? (signedInEmail ? signedInEmail.split("@")[0].charAt(0).toUpperCase() + signedInEmail.split("@")[0].slice(1) : null);

  return (
    <header className="sticky top-0 z-50 bg-[var(--color-bg-base)]/80 backdrop-blur-md">
      <Container wide className="flex h-14 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <span className="font-[family-name:var(--font-heading)] text-[15px] font-bold tracking-[-0.04em] text-[var(--color-text-primary)] leading-none">
            BTC<span className="font-light ml-[2px]">today</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <DesktopNav />

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
              <UserMenu displayName={displayName} tier={tier} />
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="hidden md:block text-[11px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            >
              Login
            </Link>
          )}
          <MobileNav signedInEmail={signedInEmail} displayName={displayName} tier={tier} />
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
