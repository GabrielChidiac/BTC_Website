"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, SECTION_LINKS, isActiveLink } from "@/lib/constants";

export function DesktopNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <nav className="hidden md:flex items-center gap-4 shrink-0">
      {NAV_LINKS.map(({ href, label }) => {
        const active = isActiveLink(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`whitespace-nowrap text-sm font-medium transition-colors ${
              active
                ? "text-[var(--color-accent)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
      {isHome && (
        <>
          <span className="h-3.5 w-px bg-[var(--color-border)]" />
          {SECTION_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="whitespace-nowrap text-[11px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {label}
            </a>
          ))}
        </>
      )}
    </nav>
  );
}
