import * as React from "react";
import { MicIcon, PauseIcon, SquareIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Waveform } from "@/components/marketing/waveform";
import { TranscriptCard } from "@/components/marketing/transcript-card";
import { SoapCard } from "@/components/marketing/soap-card";

const transcriptLines = [
  { speaker: "doctor" as const, text: "How long have you been feeling the tightness in your chest?" },
  { speaker: "patient" as const, text: "About three days now — it's worse when I climb stairs." },
  { speaker: "doctor" as const, text: "Any shortness of breath or pain radiating to your arm or jaw?" },
  { speaker: "patient" as const, text: "Some breathlessness, but no pain anywhere else." },
];

const soapSections = [
  {
    label: "S" as const,
    title: "Chief complaint",
    body: "Three-day history of exertional chest tightness with mild dyspnea. No radiation, no diaphoresis.",
  },
  {
    label: "O" as const,
    title: "Vitals & exam",
    body: "BP 138/86, HR 92, SpO₂ 97%. Lungs clear, no murmurs. ECG: normal sinus rhythm.",
  },
  {
    label: "A" as const,
    title: "Working differential",
    body: "Likely stable angina vs musculoskeletal. Cardiac workup warranted.",
  },
];

interface ProductPreviewProps {
  className?: string;
}

/**
 * Floating "live consultation" mock used in the landing hero. Composes
 * the waveform + transcript + SOAP cards inside a tilted window frame
 * so visitors see, at a glance, what the product produces.
 *
 * Same components will be reused in Phase 4 (real consultation page)
 * with real data sources.
 */
export function ProductPreview({ className }: ProductPreviewProps) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-5xl",
        // Subtle ambient halo behind the preview.
        "before:absolute before:inset-x-12 before:-bottom-8 before:-top-4",
        "before:rounded-[28px] before:bg-primary/[0.05] before:blur-2xl before:-z-10",
        className,
      )}
    >
      {/* Window frame */}
      <div className="overflow-hidden rounded-2xl border border-border-strong bg-surface-1 shadow-lg ring-inset-highlight">
        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            claria.app / consultation
          </span>
          <span className="w-9" />
        </div>

        {/* Content grid: recording controls + waveform on top, transcript + SOAP below */}
        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-5 md:gap-5 md:p-6">
          {/* Recording strip — full width */}
          <div className="md:col-span-5 flex items-center gap-4 rounded-lg border border-border bg-surface-2 px-4 py-3">
            <div className="flex items-center gap-2 shrink-0">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                <MicIcon className="h-3.5 w-3.5" />
                <span
                  aria-hidden
                  className="absolute -inset-1 animate-pulse-soft rounded-full ring-2 ring-primary/30"
                />
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-[11px] font-medium text-foreground">
                  Recording
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  04:23 · 48 kHz
                </span>
              </div>
            </div>
            <div className="h-10 min-w-0 flex-1">
              <Waveform bars={64} />
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Pause"
              >
                <PauseIcon className="h-3 w-3" />
              </button>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-1 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Stop"
              >
                <SquareIcon className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Transcript: 3 cols */}
          <TranscriptCard
            lines={transcriptLines}
            className="md:col-span-3"
          />

          {/* SOAP draft: 2 cols */}
          <SoapCard sections={soapSections} className="md:col-span-2" />
        </div>
      </div>
    </div>
  );
}
