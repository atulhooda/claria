"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ActivityIcon,
  PillIcon,
  StethoscopeIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  Medication,
  Symptom,
  VitalReading,
} from "@/lib/mocks/consultation";

interface ExtractionsPanelProps {
  symptoms: Symptom[];
  medications: Medication[];
  vitals: VitalReading[];
  className?: string;
}

export function ExtractionsPanel({
  symptoms,
  medications,
  vitals,
  className,
}: ExtractionsPanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-pane-gradient p-4 shadow-pane",
        "ring-inset-highlight",
        className,
      )}
    >
      <header className="flex items-center gap-2 pb-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          AI extractions
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/55">
          updates live
        </span>
      </header>

      <ExtractionGroup
        icon={StethoscopeIcon}
        title="Symptoms"
        count={symptoms.length}
      >
        <ul className="flex flex-wrap gap-1.5">
          <AnimatePresence initial={false}>
            {symptoms.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, y: 4, scale: 0.94, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                <SymptomPill symptom={s} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {symptoms.length === 0 ? <EmptyHint /> : null}
      </ExtractionGroup>

      <ExtractionGroup
        icon={PillIcon}
        title="Medications"
        count={medications.length}
      >
        <ul className="flex flex-col divide-y divide-border/60">
          <AnimatePresence initial={false}>
            {medications.map((m) => (
              <motion.li
                key={m.id}
                layout
                initial={{ opacity: 0, y: 4, filter: "blur(2px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center justify-between py-2.5 text-[12.5px]"
              >
                <span className="font-medium text-foreground">{m.name}</span>
                <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                  {[m.dose, m.frequency].filter(Boolean).join(" · ")}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {medications.length === 0 ? <EmptyHint /> : null}
      </ExtractionGroup>

      <ExtractionGroup icon={ActivityIcon} title="Vitals" count={vitals.length}>
        <dl className="grid grid-cols-2 gap-1.5">
          {vitals.map((v) => (
            <div
              key={v.id}
              className={cn(
                "group relative rounded-md border border-border/70 bg-surface-1 px-3 py-2.5",
                "transition-colors hover:border-border-strong hover:bg-surface-2/60",
              )}
            >
              <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {v.label}
              </dt>
              <dd className="mt-0.5 flex items-baseline gap-1 font-mono text-[14px] tabular-nums text-foreground">
                {v.value}
                {v.unit ? (
                  <span className="text-[10px] text-muted-foreground/80">
                    {v.unit}
                  </span>
                ) : null}
                {v.status === "elevated" ? (
                  <span
                    aria-label="Elevated"
                    className="ml-auto inline-flex h-1.5 w-1.5 items-center justify-center"
                  >
                    <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-destructive" />
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </ExtractionGroup>
    </section>
  );
}

interface ExtractionGroupProps {
  icon: LucideIcon;
  title: string;
  count: number;
  children: React.ReactNode;
}

function ExtractionGroup({
  icon: Icon,
  title,
  count,
  children,
}: ExtractionGroupProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-surface-2/40 p-3 transition-colors hover:border-border">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-muted-foreground" strokeWidth={2.4} />
          <span className="text-[11px] font-semibold tracking-[0.02em] text-foreground/85">
            {title}
          </span>
        </div>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

function EmptyHint() {
  return (
    <p className="py-1 text-[11px] italic text-muted-foreground/65">
      Waiting for mentions…
    </p>
  );
}

interface SymptomPillProps {
  symptom: Symptom;
}

function SymptomPill({ symptom }: SymptomPillProps) {
  const toneClass: Record<Symptom["severity"], string> = {
    mild: "border-border bg-surface-1 text-foreground/85",
    moderate: "border-border-strong bg-surface-1 text-foreground",
    severe: "border-destructive/30 bg-destructive/5 text-destructive",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        "transition-colors hover:border-border-strong",
        toneClass[symptom.severity],
      )}
    >
      {symptom.label}
      <span className="font-mono text-[9px] tabular-nums text-muted-foreground/80">
        {Math.round(symptom.confidence * 100)}%
      </span>
    </span>
  );
}
