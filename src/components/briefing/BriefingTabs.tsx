"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProTeaser } from "@/components/premium/ProTeaser";
import { TAB_BRIEFING, TAB_DEEP_DIVE, SECTION_TAB_MAP } from "@/lib/constants";

interface FoundingOffer {
  spotsLeft: number;
  limit: number;
}

interface BriefingTabsProps {
  tab1Content: ReactNode;
  tab2Content: ReactNode;
  isPro: boolean;
  foundingOffer?: FoundingOffer | null;
}

function scrollToSection(hash: string) {
  // Double rAF ensures React has committed the DOM update before scrolling
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const el = document.getElementById(hash);
      el?.scrollIntoView({ behavior: "smooth" });
    });
  });
}

function getTabForHash(hash: string): string | null {
  const sectionId = hash.replace("#", "");
  return SECTION_TAB_MAP[sectionId] ?? null;
}

export function BriefingTabs({ tab1Content, tab2Content, isPro, foundingOffer }: BriefingTabsProps) {
  const [activeTab, setActiveTab] = useState<string>(TAB_BRIEFING);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Listen for hash changes and custom events from nav
  useEffect(() => {
    // Check initial hash on mount
    if (window.location.hash) {
      const tab = getTabForHash(window.location.hash);
      if (tab) {
        setActiveTab(tab);
        scrollToSection(window.location.hash.replace("#", ""));
      }
    }

    const onHashChange = () => {
      if (window.location.hash) {
        const tab = getTabForHash(window.location.hash);
        if (tab) {
          setActiveTab(tab);
          scrollToSection(window.location.hash.replace("#", ""));
        }
      }
    };

    const onTabSwitch = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab) {
        setActiveTab(detail.tab);
        if (detail.hash) {
          scrollToSection(detail.hash);
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
              <span className="text-[9px] font-medium tracking-[0.08em] text-[var(--color-text-muted)] opacity-50">
                2/2
              </span>
              {!isPro && (
                <Lock size={11} className="text-[var(--color-text-muted)] opacity-60" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab panels */}
        <TabsContent value={TAB_BRIEFING} className="outline-none">
          {tab1Content}
        </TabsContent>

        <TabsContent value={TAB_DEEP_DIVE} className="outline-none">
          {isPro ? (
            tab2Content
          ) : (
            <ProTeaser
              variant="tab"
              foundingOffer={foundingOffer}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
