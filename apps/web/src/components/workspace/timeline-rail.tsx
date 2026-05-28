"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ActivityIcon,
  CalendarClockIcon,
  MessageSquareIcon,
  PillIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { TimelineMarker } from "@/lib/mocks/consultation";

interface TimelineRailProps {
  markers: TimelineMarker[];
  /** Current elapsed seconds, used to render the playhead. */
  elapsedSec: number;
  className?: string;
}

const KIND_META: Record<
  TimelineMarker["kind"],
  { icon: LucideIcon; label: string }
> = {
  topic: { icon: MessageSquareIcon, label: "Topic" },
  vital: { icon: ActivityIcon, label: "Vital" },
  medication: { icon: PillIcon, label: "Medication" },
  "follow-up": { icon: CalendarClockIcon, label: "Follow-up" },
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function TimelineRail({
  markers,
  elapsedSec,
  className,
}: TimelineRailProps) {
  const latestId = markers[markers.length - 1]?.id;

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-xl border border-border bg-pane-gradient shadow-pane",
        "ring-inset-highlight",
        className,
      )}
    >
      <header className="flex items-center justify-between border-b border-border/80 px-4 py-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Timeline
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
          {formatTime(elapsedSec)}
        </span>
      </header>

      <ol className="relative flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:hsl(var(--border-strong))_transparent] [scrollbar-width:thin]">
        {/* Vertical line behind the markers. */}
        <span
          aria-hidden
          className="absolute left-[26px] top-4 bottom-4 w-px bg-border/80"
        />

        <AnimatePresence initial={false}>
          {markers.map((m) => {
            const Icon = KIND_META[m.kind].icon;
            const isLatest = m.id === latestId;
            return (
              <motion.li
                key={m.id}
                layout
                initial={{ opacity: 0, x: -6, filter: "blur(2px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="group relative mb-3.5 flex cursor-pointer items-start gap-3 last:mb-0"
              >
                <span
                  className={cn(
                    "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all",
                    isLatest
                      ? "border-primary/50 bg-surface-1 text-primary shadow-glow-warm"
                      : "border-border bg-surface-1 text-muted-foreground group-hover:border-border-strong group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-3 w-3" strokeWidth={2.4} />
                  {isLatest ? (
                    <span
                      aria-hidden
                      className="absolute -inset-1 animate-pulse-soft rounded-full ring-1 ring-primary/25"
                    />
                  ) : null}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                  <span className="truncate text-[12.5px] font-medium text-foreground transition-colors group-hover:text-foreground">
                    {m.label}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground/75">
                    {formatTime(m.timestampSec)} · {KIND_META[m.kind].label}
                  </span>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>

        {markers.length === 0 ? (
          <p className="pl-9 text-[11px] italic text-muted-foreground/65">
            Markers will appear as the consult progresses.
          </p>
        ) : null}
      </ol>
    </aside>
  );
}
