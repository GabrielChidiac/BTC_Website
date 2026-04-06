import Link from "next/link";
import { Container } from "./Container";
import { BitcoinCoin } from "@/components/hero/BitcoinCoin";

export function Footer() {
  return (
    <footer className="mt-10 border-t border-[var(--color-border)] py-10">
      <Container className="flex flex-col items-center gap-5 text-center">
        <div className="flex items-center gap-4">
          <BitcoinCoin className="relative z-10 size-10 drop-shadow-[0_2px_8px_rgba(247,147,26,0.35)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            Data refreshed every day at 2 AM CET.
          </p>
          <BitcoinCoin className="relative z-10 size-10 drop-shadow-[0_2px_8px_rgba(247,147,26,0.35)]" />
        </div>

        {/* Nav links */}
        <nav className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
          <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">Briefing</Link>
          <span className="h-3 w-px bg-[var(--color-border)]" />
          <Link href="/archive" className="hover:text-[var(--color-accent)] transition-colors">Archive</Link>
          <span className="h-3 w-px bg-[var(--color-border)]" />
          <Link href="/pricing" className="hover:text-[var(--color-accent)] transition-colors">Pricing</Link>
          <span className="h-3 w-px bg-[var(--color-border)]" />
          <a
            href="mailto:hello@btctoday.co"
            className="hover:text-[var(--color-accent)] transition-colors"
          >
            Contact
          </a>
        </nav>

        {/* Legal + copyright */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
            <Link href="/privacy" className="hover:text-[var(--color-accent)] transition-colors">Privacy Policy</Link>
            <span className="h-3 w-px bg-[var(--color-border)]" />
            <Link href="/terms" className="hover:text-[var(--color-accent)] transition-colors">Terms of Service</Link>
          </div>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            &copy; {new Date().getFullYear()} BTC Today. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
