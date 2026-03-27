"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface ExpandableCardProps {
  children: React.ReactNode;
  preview: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function ExpandableCard({
  children,
  preview,
  defaultOpen = false,
  className = "",
}: ExpandableCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card
        className={cn(
          "card-interactive gap-0 py-0 ring-1 ring-[var(--color-border)] ring-foreground/0",
          className
        )}
      >
        <CollapsibleTrigger
          className="flex w-full items-start justify-between gap-3 p-5 sm:p-6 text-left cursor-pointer"
        >
          <div className="min-w-0 flex-1">{preview}</div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={cn(
              "mt-1 shrink-0 text-[var(--color-text-muted)] transition-transform duration-300",
              "ease-[cubic-bezier(0.33,1,0.68,1)]",
              open && "rotate-180"
            )}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </CollapsibleTrigger>

        <CollapsibleContent className="overflow-hidden transition-[height,opacity] data-[ending-style]:h-0 data-[starting-style]:h-0">
          <CardContent className="px-5 pb-5 pt-0 sm:px-6 sm:pb-6">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
