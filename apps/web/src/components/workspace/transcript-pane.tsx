"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";
import type { AiActivity } from "@/hooks/use-mock-stream";
import type { TranscriptLine } from "@/lib/mocks/consultation";

interface TranscriptPaneProps {
  lines: TranscriptLine[];
  activity: AiActivity;
  className?: string;
}

const SPEAKER_LABEL: Record<TranscriptLine["speaker"], string> = {
  doctor: "Dr. Patel",
  patient: "Patient",
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function TranscriptPane({ lines, activity, className }: TranscriptPaneProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const lastLineId = lines[lines.length - 1]?.id;

  // Auto-scroll to bottom when a new line arrives.
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines.length]);

  return (
    <section
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-pane-gradient shadow-pane",
        "ring-inset-highlight",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border/80 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Live transcript
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">
            {lines.length} {lines.length === 1 ? "line" : "lines"}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          en-US · medical
        </span>
      </header>

      {/* Top fade — softens scroll-into-view so lines emerge from a haze. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[44px] z-10 h-6 bg-gradient-to-b from-surface-1 to-transparent"
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-1 py-5 [scrollbar-color:hsl(var(--border-strong))_transparent] [scrollbar-width:thin]"
      >
        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {lines.map((line) => {
              const isLatest = line.id === lastLineId;
              return (
                <motion.li
                  key={line.id}
                  layout
                  initial={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{
                    duration: 0.42,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={cn(
                    "flex gap-4 rounded-md px-4 py-2.5 transition-colors",
                    "hover:bg-surface-2/50",
                    isLatest && "fresh-edge",
                  )}
                >
                  <span className="flex w-[88px] shrink-0 flex-col gap-0.5 pt-0.5">
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.12em]",
                        line.speaker === "doctor"
                          ? "text-primary/85"
                          : "text-muted-foreground",
                      )}
                    >
                      {SPEAKER_LABEL[line.speaker]}
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/55">
                      {formatTime(line.timestampSec)}
                    </span>
                  </span>
                  <p className="flex-1 text-[15px] leading-[1.65] text-foreground/90">
                    {line.text}
                  </p>
                </motion.li>
              );
            })}
          </AnimatePresence>

          {activity !== "idle" ? (
            <li className="flex gap-4 px-4 pt-2" aria-live="polite">
              <span className="w-[88px] shrink-0" />
              <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground/75">
                <ListeningDots />
                <span className="tabular-nums">
                  {activity === "listening" && "Listening…"}
                  {activity === "transcribing" && "Transcribing…"}
                  {activity === "drafting" && "Drafting note…"}
                </span>
              </span>
            </li>
          ) : null}
        </ul>
      </div>

      {/* Bottom fade — mirror of top so the latest line glides cleanly into the controls. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-8 bg-gradient-to-t from-surface-1 to-transparent"
      />
    </section>
  );
}

function ListeningDots() {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 origin-bottom rounded-full bg-primary/55 animate-waveform-bar"
          style={{ animationDelay: `${i * 0.18}s`, animationDuration: "1.1s" }}
        />
      ))}
    </span>
  );
}
