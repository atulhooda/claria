"use client";

import * as React from "react";
import { AlertTriangleIcon, MicIcon, Loader2Icon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { RecorderState } from "@/hooks/use-recorder";

interface MicPermissionGateProps {
  state: RecorderState;
  error: string | null;
  onRequest: () => void | Promise<unknown>;
  className?: string;
}

/**
 * Shown in place of the workspace until the browser confirms microphone
 * permission. Three terminal states:
 *
 *   - idle / requesting-permission → big "Allow" CTA + spinner while pending
 *   - permission-denied → error with re-enable instructions
 *   - ready / recording / paused → component renders nothing (parent shows workspace)
 */
export function MicPermissionGate({
  state,
  error,
  onRequest,
  className,
}: MicPermissionGateProps) {
  if (state === "ready" || state === "recording" || state === "paused") {
    return null;
  }

  const requesting = state === "requesting-permission";
  const denied = state === "permission-denied" || state === "error";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col items-center rounded-2xl border border-border bg-pane-gradient px-10 py-12 text-center shadow-pane",
        "ring-inset-highlight",
        className,
      )}
    >
      <span
        className={cn(
          "relative mb-5 inline-flex h-14 w-14 items-center justify-center rounded-full",
          denied
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary",
        )}
      >
        {denied ? (
          <AlertTriangleIcon className="h-6 w-6" strokeWidth={2.2} />
        ) : (
          <MicIcon className="h-6 w-6" strokeWidth={2.2} />
        )}
        {requesting ? (
          <span
            aria-hidden
            className="absolute -inset-1 animate-pulse-soft rounded-full ring-2 ring-primary/25"
          />
        ) : null}
      </span>

      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {denied
          ? "Microphone access blocked"
          : "Allow microphone access to begin"}
      </h2>

      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {denied
          ? error ||
            "Your browser blocked microphone access. Re-enable it in your address bar's site settings, then refresh to start the consultation."
          : "Claria streams audio from your microphone to its transcription pipeline. Nothing is stored unless you finalize the consultation."}
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        {denied ? (
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") window.location.reload();
            }}
          >
            Refresh page
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => {
              void onRequest();
            }}
            disabled={requesting}
            className="gap-2"
          >
            {requesting ? (
              <>
                <Loader2Icon className="h-4 w-4 animate-spin" />
                Waiting for permission…
              </>
            ) : (
              <>
                <MicIcon className="h-4 w-4" />
                Allow microphone
              </>
            )}
          </Button>
        )}
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
        End-to-end audio · 16 kHz · mono
      </p>
    </div>
  );
}
