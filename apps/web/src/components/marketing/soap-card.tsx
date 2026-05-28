import * as React from "react";
import { SparklesIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface SoapSection {
  label: "S" | "O" | "A" | "P";
  title: string;
  body: string;
}

interface SoapCardProps {
  sections: SoapSection[];
  className?: string;
}

const SECTION_TITLE: Record<SoapSection["label"], string> = {
  S: "Subjective",
  O: "Objective",
  A: "Assessment",
  P: "Plan",
};

export function SoapCard({ sections, className }: SoapCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-surface-1 p-5 shadow-elevated",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
            <SparklesIcon className="h-3 w-3" strokeWidth={2.4} />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            AI draft
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/80">
          SOAP · v1
        </span>
      </header>

      <div className="flex flex-col gap-3">
        {sections.map((section) => (
          <section key={section.label} className="flex gap-3">
            <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-surface-3 font-mono text-[10px] font-semibold text-foreground/70">
              {section.label}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {SECTION_TITLE[section.label]} — {section.title}
              </span>
              <p className="text-sm leading-snug text-foreground/85">
                {section.body}
              </p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
