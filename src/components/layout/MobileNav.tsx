"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, SECTION_LINKS, SECTION_TAB_MAP, isActiveLink } from "@/lib/constants";
import type { SubscriberTier } from "@/lib/types";

export function MobileNav({ signedInEmail, displayName, tier = "free" }: { signedInEmail?: string | null; displayName?: string | null; tier?: SubscriberTier }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

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
          className="fixed inset-0 top-[57px] z-[70] bg-black/20 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <nav
        className={`fixed top-[57px] right-0 z-[80] h-[calc(100vh-57px)] w-64 max-w-[80vw] bg-[rgb(240,240,246)] border-l border-[var(--color-border)] p-6 transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const active = isActiveLink(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  active
                    ? "text-[var(--color-accent)] bg-[var(--color-accent)]/5"
                    : "text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
        {isHome && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="px-4 pb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Jump to
            </p>
            <div className="flex flex-col gap-1">
              {SECTION_LINKS.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={(e) => {
                    const sectionId = href.replace("/#", "");
                    const targetTab = SECTION_TAB_MAP[sectionId];
                    setOpen(false);
                    if (targetTab) {
                      e.preventDefault();
                      window.dispatchEvent(
                        new CustomEvent("briefing-tab-switch", { detail: { tab: targetTab, hash: sectionId } })
                      );
                    }
                    // Sections not in SECTION_TAB_MAP (e.g. #insight) use default anchor scroll
                  }}
                  className="rounded-lg px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-elevated)] transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Auth */}
        <div className="mt-4 border-t border-[var(--color-border)] pt-4 px-4">
          {signedInEmail ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {displayName ?? signedInEmail}
                </p>
                {tier === "pro" && (
                  <span className="shrink-0 rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                    Pro
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/logout", { method: "POST" });
                      if (res.ok) {
                        setOpen(false);
                        window.location.reload();
                      } else {
                        alert("Logout failed. Please try again.");
                      }
                    } catch {
                      alert("Network error. Please try again.");
                    }
                  }}
                  className="cursor-pointer text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  Log out
                </button>
                <span className="h-3 w-px bg-[var(--color-border)]" />
                <button
                  onClick={async () => {
                    if (confirm("Stop all emails and deactivate your account?")) {
                      try {
                        const res = await fetch("/api/unsubscribe", { method: "POST" });
                        if (res.ok) {
                          setOpen(false);
                          window.location.href = "/";
                        } else {
                          alert("Unsubscribe failed. Please try again.");
                        }
                      } catch {
                        alert("Network error. Please try again.");
                      }
                    }
                  }}
                  className="cursor-pointer text-[11px] text-[var(--color-text-muted)] hover:text-red-500 transition-colors"
                >
                  Unsubscribe
                </button>
              </div>
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
