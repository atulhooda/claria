import * as React from "react";

import { cn } from "@/lib/utils";

interface ConfidenceMeterProps {
  /** 0–1 scalar. */
  value: number;
  className?: string;
  /** Show the numeric percent next to the bar. */
  showValue?: boolean;
  /** Tightly-set or comfortably padded label position. */
  size?: "sm" | "md";
  /** Active "AI is drafting this right now" hint — adds a moving shimmer. */
  drafting?: boolean;
}

/**
 * Slim horizontal bar showing AI confidence. Fills from left, animated
 * on prop change via a CSS transition (cheaper than framer-motion for
 * a one-dimensional width tween). When `drafting`, a moving shimmer
 * overlay communicates "the model is still working on this."
 */
export function ConfidenceMeter({
  value,
  className,
  showValue = true,
  size = "sm",
  drafting = false,
}: ConfidenceMeterProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const isLow = value < 0.55;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex-1 overflow-hidden rounded-full bg-surface-3/80",
          size === "sm" ? "h-[3px]" : "h-1.5",
        )}
        aria-label={`Confidence ${Math.round(pct)}%`}
      >
        {/* Filled portion — a subtle gradient reads less flat than solid. */}
        <span
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            "transition-[width] [transition-duration:var(--duration-slower)] ease-out",
            isLow
              ? "bg-muted-foreground/55"
              : "bg-gradient-to-r from-primary/65 via-primary/80 to-primary",
          )}
          style={{ width: `${pct}%` }}
        />
        {/* Drafting shimmer — only visible while AI is actively working this section. */}
        {drafting ? (
          <span
            aria-hidden
            className="ai-shimmer absolute inset-0 rounded-full"
          />
        ) : null}
      </div>
      {showValue ? (
        <span className="w-9 shrink-0 text-right font-mono text-[10px] text-muted-foreground tabular-nums">
          {Math.round(pct)}%
        </span>
      ) : null}
    </div>
  );
}
