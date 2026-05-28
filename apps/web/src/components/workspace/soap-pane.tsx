"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { PencilIcon, SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfidenceMeter } from "@/components/workspace/confidence-meter";
import type { SoapSection } from "@/lib/mocks/consultation";

interface SoapPaneProps {
  sections: SoapSection[];
  className?: string;
}

const FULL_TITLE: Record<SoapSection["label"], string> = {
  S: "Subjective",
  O: "Objective",
  A: "Assessment",
  P: "Plan",
};

export function SoapPane({ sections, className }: SoapPaneProps) {
  // The "currently drafting" section is the first one not yet near-done.
  const draftingIdx = React.useMemo(
    () => sections.findIndex((s) => s.confidence > 0 && s.confidence < 0.85),
    [sections],
  );

  return (
    <section
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border bg-pane-gradient shadow-pane",
        "ring-inset-highlight",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border/80 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SparklesIcon className="h-3 w-3" strokeWidth={2.4} />
            {draftingIdx >= 0 ? (
              <span
                aria-hidden
                className="absolute -inset-1 animate-pulse-soft rounded-full ring-2 ring-primary/15"
              />
            ) : null}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            AI clinical note
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/70">SOAP · v1</span>
      </header>

      <div className="flex-1 overflow-y-auto [scrollbar-color:hsl(var(--border-strong))_transparent] [scrollbar-width:thin]">
        <ol className="flex flex-col divide-y divide-border/70">
          {sections.map((section, idx) => (
            <SoapSectionRow
              key={section.label}
              section={section}
              index={idx}
              drafting={idx === draftingIdx}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

interface SoapSectionRowProps {
  section: SoapSection;
  index: number;
  drafting: boolean;
}

function SoapSectionRow({ section, index, drafting }: SoapSectionRowProps) {
  const empty = section.confidence === 0;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.42,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={cn(
        "group flex flex-col gap-3 px-5 py-5 transition-colors",
        drafting && "bg-primary/[0.018]",
        !empty && "hover:bg-surface-2/40",
      )}
    >
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-[12px] font-semibold transition-colors",
            drafting
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-surface-2 text-foreground/80",
          )}
        >
          {section.label}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-foreground/85">
            {FULL_TITLE[section.label]}
            <span className="ml-2 text-[10px] font-normal normal-case tracking-normal text-muted-foreground/75">
              {section.title}
            </span>
          </span>
          <ConfidenceMeter value={section.confidence} drafting={drafting} />
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${FULL_TITLE[section.label]}`}
          className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <PencilIcon className="h-3 w-3" />
        </Button>
      </header>

      <p
        className={cn(
          "pl-10 text-[14px] leading-[1.7] text-foreground/85",
          empty && "italic text-muted-foreground/60",
        )}
      >
        {empty ? "Waiting for transcript signal…" : section.body}
      </p>
    </motion.li>
  );
}
