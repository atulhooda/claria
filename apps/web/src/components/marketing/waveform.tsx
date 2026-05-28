import * as React from "react";

import { cn } from "@/lib/utils";

interface WaveformProps {
  /** Number of vertical bars to render. */
  bars?: number;
  className?: string;
  /** Static mode renders bars at fixed heights (no animation) — useful for screenshots. */
  static?: boolean;
}

/**
 * Pseudo-live audio waveform. Pure CSS — each bar has a staggered
 * `waveform-bar` keyframe with a per-bar `animationDelay` so the bars
 * appear to undulate like a real recording meter.
 *
 * Heights are deterministic (not random) so SSR and client agree.
 */
export function Waveform({
  bars = 48,
  className,
  static: isStatic = false,
}: WaveformProps) {
  const seeds = React.useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        // Deterministic pseudo-random based on index — keeps SSR & client identical.
        const phase = (i * 1.61803) % 1;
        const heightPct = 18 + Math.abs(Math.sin(i * 0.7)) * 64;
        return { phase, heightPct };
      }),
    [bars],
  );

  return (
    <div
      className={cn("flex h-full w-full items-end gap-[3px]", className)}
      aria-hidden
    >
      {seeds.map((s, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] origin-bottom rounded-full bg-primary/70",
            isStatic ? "" : "animate-waveform-bar",
          )}
          style={{
            height: `${s.heightPct}%`,
            animationDelay: isStatic ? undefined : `${(s.phase * 1.4).toFixed(3)}s`,
            animationDuration: isStatic ? undefined : `${(1.1 + (i % 5) * 0.18).toFixed(2)}s`,
          }}
        />
      ))}
    </div>
  );
}
