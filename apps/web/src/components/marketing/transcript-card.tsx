"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useTypewriter } from "@/hooks/use-typewriter";

interface TranscriptLine {
  speaker: "doctor" | "patient";
  text: string;
}

interface TranscriptCardProps {
  lines: TranscriptLine[];
  /** Last line types out live; previous lines render instantly. */
  liveLastLine?: boolean;
  className?: string;
}

const SPEAKER_LABEL: Record<TranscriptLine["speaker"], string> = {
  doctor: "Dr. Patel",
  patient: "Patient",
};

export function TranscriptCard({
  lines,
  liveLastLine = true,
  className,
}: TranscriptCardProps) {
  const last = lines[lines.length - 1];
  const prior = lines.slice(0, -1);
  const { text: liveText, done } = useTypewriter(last?.text ?? "", {
    cps: 40,
    startDelay: 600,
    freeze: !liveLastLine,
  });

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-surface-1 p-5 shadow-elevated",
        className,
      )}
    >
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 animate-pulse-soft rounded-full bg-destructive/80" />
            <span className="relative h-2 w-2 rounded-full bg-destructive" />
          </span>
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Live transcript
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/80">
          00:04:23
        </span>
      </header>

      <div className="flex flex-col gap-2.5 text-sm leading-relaxed text-foreground/90">
        {prior.map((line, i) => (
          <p key={i} className="flex gap-2">
            <span
              className={cn(
                "shrink-0 font-mono text-[10px] uppercase tracking-wider pt-1",
                line.speaker === "doctor"
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              {SPEAKER_LABEL[line.speaker]}
            </span>
            <span>{line.text}</span>
          </p>
        ))}
        {last ? (
          <p className="flex gap-2">
            <span
              className={cn(
                "shrink-0 font-mono text-[10px] uppercase tracking-wider pt-1",
                last.speaker === "doctor"
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              {SPEAKER_LABEL[last.speaker]}
            </span>
            <span>
              {liveText}
              {!done ? (
                <span
                  className="ml-0.5 inline-block h-3.5 w-[2px] -mb-[2px] animate-pulse-soft bg-primary align-middle"
                  aria-hidden
                />
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
