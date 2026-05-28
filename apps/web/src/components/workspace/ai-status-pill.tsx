"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckIcon,
  Loader2Icon,
  MicIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { AiActivity } from "@/hooks/use-mock-stream";

const STATE_META: Record<AiActivity, { label: string; icon: LucideIcon }> = {
  idle: { label: "Idle", icon: CheckIcon },
  listening: { label: "Listening", icon: MicIcon },
  transcribing: { label: "Transcribing", icon: Loader2Icon },
  drafting: { label: "Drafting note", icon: SparklesIcon },
};

interface AiStatusPillProps {
  activity: AiActivity;
  className?: string;
}

/**
 * Slim status pill that morphs between AI states. Uses AnimatePresence
 * so the label crossfades on transition; the dot pulses while active;
 * the pill itself gets a soft warm glow when the model is working.
 */
export function AiStatusPill({ activity, className }: AiStatusPillProps) {
  const { label, icon: Icon } = STATE_META[activity];
  const isActive = activity !== "idle";
  const spins = activity === "transcribing";

  return (
    <div
      className={cn(
        "relative inline-flex items-center gap-2 rounded-full border bg-pane-gradient pl-2.5 pr-3.5 py-1.5 text-[12px] font-medium text-foreground/90 backdrop-blur-sm",
        "transition-all [transition-duration:var(--duration-base)] ease-out",
        isActive
          ? "border-primary/25 shadow-glow-warm"
          : "border-border shadow-sm",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inset-0 rounded-full",
            isActive ? "animate-pulse-soft bg-primary/35" : "bg-transparent",
          )}
        />
        <span
          className={cn(
            "relative h-2 w-2 rounded-full transition-colors",
            isActive ? "bg-primary" : "bg-muted-foreground/40",
          )}
        />
      </span>
      <span className="inline-flex items-center gap-1.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={`icon-${activity}`}
            initial={{ opacity: 0, scale: 0.7, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="inline-flex"
          >
            <Icon
              className={cn(
                "h-3 w-3 text-muted-foreground",
                isActive && "text-primary/75",
                spins && "animate-spin",
              )}
              strokeWidth={2.4}
            />
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={activity}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block min-w-[80px] tabular-nums"
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>
  );
}
