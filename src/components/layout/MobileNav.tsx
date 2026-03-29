"use client";

import { useState } from "react";
import Link from "next/link";

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

export function MobileNav({ signedInEmail, displayName }: { signedInEmail?: string | null; displayName?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/50"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          {open ? (
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          ) : (
            <>
              <path d="M3 6H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 10H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M3 14H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 top-[57px] z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <nav
        className={`fixed top-[57px] right-0 z-50 h-[calc(100vh-57px)] w-64 bg-[var(--color-bg-surface)] border-l border-[var(--color-border)] p-6 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-1">
          {navLinks.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-3 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <p className="px-4 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            Jump to
          </p>
          <div className="flex flex-col gap-1">
            {sectionLinks.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)] transition-colors"
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        {/* Auth */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4 px-4">
          {signedInEmail ? (
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                {displayName ?? signedInEmail}
              </p>
              <button
                onClick={async () => {
                  await fetch("/api/logout", { method: "POST" });
                  setOpen(false);
                  window.location.reload();
                }}
                className="cursor-pointer text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
              >
                Log out
              </button>
            </div>
          ) : (
            <Link
              href="/sign-in"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
