"use client";

import * as React from "react";
import { MicIcon, PauseIcon, PlayIcon, SquareIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Waveform } from "@/components/marketing/waveform";

interface RecordingBarProps {
  /** Elapsed time in seconds. */
  elapsedSec: number;
  playing: boolean;
  onPlayToggle: () => void;
  onStop: () => void;
  className?: string;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function RecordingBar({
  elapsedSec,
  playing,
  onPlayToggle,
  onStop,
  className,
}: RecordingBarProps) {
  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border bg-pane-gradient px-4 py-3 backdrop-blur-xl md:gap-4",
        "ring-inset-highlight transition-all [transition-duration:var(--duration-base)] ease-out",
        playing
          ? "border-border-strong shadow-glow-warm"
          : "border-border shadow-pane",
        className,
      )}
    >
      {/* Mic + status */}
      <div className="flex shrink-0 items-center gap-2.5">
        <span
          className={cn(
            "relative inline-flex h-9 w-9 items-center justify-center rounded-full text-primary-foreground shadow-sm transition-all",
            playing ? "bg-primary scale-100" : "bg-primary/85 scale-[0.96]",
          )}
        >
          <MicIcon className="h-4 w-4" />
          {playing ? (
            <>
              <span
                aria-hidden
                className="absolute -inset-1 animate-pulse-soft rounded-full ring-2 ring-primary/25"
              />
              <span
                aria-hidden
                className="absolute -inset-2 rounded-full ring-1 ring-primary/10"
                style={{ animation: "pulse-soft 3.4s ease-in-out infinite" }}
              />
            </>
          ) : null}
        </span>
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="text-[11px] font-semibold tracking-[0.02em] text-foreground">
            {playing ? "Recording" : "Paused"}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground/85">
            {formatTime(elapsedSec)} · 48 kHz
          </span>
        </div>
      </div>

      {/* Waveform with subtle halo when playing */}
      <div className="relative h-9 min-w-0 flex-1">
        {playing ? (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 inset-y-1 -z-10 rounded-full bg-primary/[0.04] blur-md"
          />
        ) : null}
        <Waveform bars={64} static={!playing} />
      </div>

      {/* Mobile timer */}
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground sm:hidden">
        {formatTime(elapsedSec)}
      </span>

      {/* Controls */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={onPlayToggle}
              aria-label={playing ? "Pause recording" : "Resume recording"}
            >
              {playing ? (
                <PauseIcon className="h-3.5 w-3.5" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{playing ? "Pause" : "Resume"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              onClick={onStop}
              aria-label="Stop and finalize"
            >
              <SquareIcon className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop &amp; finalize</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
