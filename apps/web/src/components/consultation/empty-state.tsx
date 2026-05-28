import { MicIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface EmptyConsultationStateProps {
  title?: string;
  description?: string;
  ctaLabel?: string;
}

export function EmptyConsultationState({
  title = "No consultations yet",
  description = "Start a new consultation to record audio, transcribe, and generate the clinical note.",
  ctaLabel = "Start consultation",
}: EmptyConsultationStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card px-6 py-16 text-center animate-fade-in">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <MicIcon className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button className="mt-6" disabled>
        {ctaLabel}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground/70">
        Recording becomes available once auth and microphone access are wired up.
      </p>
    </div>
  );
}
