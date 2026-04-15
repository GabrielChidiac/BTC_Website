"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TAB_BRIEFING, TAB_DEEP_DIVE, SECTION_TAB_MAP } from "@/lib/constants";

gsap.registerPlugin(ScrollTrigger);

interface BriefingTabsProps {
  tab1Content: ReactNode;
  tab2Content: ReactNode;
  locked?: boolean;
}

function LockIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-[var(--color-accent)] opacity-80"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function refreshAndScroll(hash?: string) {
  // Double rAF ensures React has committed the DOM update
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      // Recalculate all GSAP ScrollTrigger positions after tab content becomes visible
      ScrollTrigger.refresh();
      if (hash) {
        const el = document.getElementById(hash);
        el?.scrollIntoView({ behavior: "smooth" });
      }
    });
  });
}

function getTabForHash(hash: string): string | null {
  const sectionId = hash.replace("#", "");
  return SECTION_TAB_MAP[sectionId] ?? null;
}

export function BriefingTabs({ tab1Content, tab2Content, locked = false }: BriefingTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(TAB_BRIEFING);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Listen for hash changes and custom events from nav
  useEffect(() => {
    // Check initial hash on mount
    if (window.location.hash) {
      const tab = getTabForHash(window.location.hash);
      if (tab) {
        setActiveTab(tab);
        refreshAndScroll(window.location.hash.replace("#", ""));
      }
    }

    const onHashChange = () => {
      if (window.location.hash) {
        const tab = getTabForHash(window.location.hash);
        if (tab) {
          setActiveTab(tab);
          refreshAndScroll(window.location.hash.replace("#", ""));
        }
      }
    };

    const onTabSwitch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) {
        setActiveTab(detail.tab);
        if (detail.hash) {
          refreshAndScroll(detail.hash);
        }
      }
    };

    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("briefing-tab-switch", onTabSwitch);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("briefing-tab-switch", onTabSwitch);
    };
  }, []);

  const handleValueChange = (value: string | number | null) => {
    if (typeof value === "string") {
      setActiveTab(value);
      // Scroll to top of tabs area on manual tab click
      tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Refresh ScrollTrigger so animations fire in newly-visible tab
      refreshAndScroll();
    }
  };

  return (
    <div ref={tabsRef} className="scroll-mt-16">
      <Tabs value={activeTab} onValueChange={handleValueChange} className="gap-0">
        {/* Sticky tab bar */}
        <div className="sticky top-[57px] z-40 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 bg-[var(--color-bg-base)]/80 backdrop-blur-md border-b border-[var(--color-border)]/50">
          <TabsList variant="line" className="w-full justify-start gap-0 h-auto py-0">
            <TabsTrigger
              value={TAB_BRIEFING}
              className="relative flex items-center gap-2 rounded-none border-0 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] font-[family-name:var(--font-heading)] text-[var(--color-text-muted)] data-active:text-[var(--color-text-primary)] hover:text-[var(--color-text-secondary)] transition-colors after:bottom-0 after:h-[2px] after:bg-[var(--color-accent)] data-active:after:opacity-100"
            >
              <span>Today&rsquo;s Briefing</span>
              <span className="text-[9px] font-medium tracking-[0.08em] text-[var(--color-text-muted)] opacity-50">
                1/2
              </span>
            </TabsTrigger>
            <TabsTrigger
              value={TAB_DEEP_DIVE}
              className="relative flex items-center gap-2 rounded-none border-0 px-4 py-3 text-xs font-semibold uppercase tracking-[0.1em] font-[family-name:var(--font-heading)] text-[var(--color-text-muted)] data-active:text-[var(--color-text-primary)] hover:text-[var(--color-text-secondary)] transition-colors after:bottom-0 after:h-[2px] after:bg-[var(--color-accent)] data-active:after:opacity-100"
            >
              <span>Deep Dive</span>
              {locked && <LockIcon />}
              <span className="text-[9px] font-medium tracking-[0.08em] text-[var(--color-text-muted)] opacity-50">
                2/2
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab panels */}
        <TabsContent value={TAB_BRIEFING} className="outline-none">
          {tab1Content}
        </TabsContent>

        <TabsContent value={TAB_DEEP_DIVE} className="outline-none">
          {tab2Content}
        </TabsContent>
      </Tabs>
    </div>
  );
}
