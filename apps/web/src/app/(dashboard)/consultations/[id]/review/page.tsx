"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PrinterIcon,
  SignatureIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TranscriptPane } from "@/components/workspace/transcript-pane";
import { SoapPane } from "@/components/workspace/soap-pane";
import { ExtractionsPanel } from "@/components/workspace/extractions-panel";
import { TimelineRail } from "@/components/workspace/timeline-rail";
import {
  useConsultationDetail,
  useMarkReviewed,
  type ConsultationDetail,
} from "@/lib/api/consultations";
import type {
  Medication,
  SoapSection,
  Symptom,
  TimelineMarker,
  TranscriptLine,
  VitalReading,
} from "@/lib/mocks/consultation";

interface PageProps {
  params: { id: string };
}

const SOAP_TITLES: Record<"S" | "O" | "A" | "P", string> = {
  S: "Subjective",
  O: "Objective",
  A: "Assessment",
  P: "Plan",
};

export default function ReviewPage({ params }: PageProps) {
  const { id } = React.use(
    params as unknown as Promise<{ id: string }>,
  );
  const { data, error, isLoading } = useConsultationDetail(id);
  const markReviewedMut = useMarkReviewed(id);

  if (isLoading) return <ReviewSkeleton />;
  if (error) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
        Could not load consultation: {error.message}
      </div>
    );
  }
  if (!data) return null;

  const adapted = adaptDetail(data);

  return (
    <div className="flex flex-col gap-5">
      {/* Sticky review header */}
      <header className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-pane-gradient px-4 py-3.5 shadow-pane ring-inset-highlight">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/consultations"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Back to consultations"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
          </TooltipTrigger>
          <TooltipContent>Back to consultations</TooltipContent>
        </Tooltip>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-[14px] font-semibold tracking-[-0.01em]">
              {data.patient.name || "Untitled consultation"}
            </h1>
            {data.patient.age || data.patient.pronouns ? (
              <Badge variant="muted" className="hidden sm:inline-flex">
                {data.patient.age ?? "—"} · {data.patient.pronouns || "—"}
              </Badge>
            ) : null}
            <Badge
              variant={data.status === "reviewed" ? "muted" : "outline"}
              className="gap-1.5"
            >
              {data.status === "reviewed" ? (
                <CheckCircle2Icon className="h-3 w-3" strokeWidth={2.4} />
              ) : (
                <SignatureIcon className="h-3 w-3" strokeWidth={2.4} />
              )}
              {data.status === "reviewed" ? "Reviewed" : "Completed"}
            </Badge>
          </div>
          <p className="truncate text-[12px] leading-tight text-muted-foreground">
            {data.summary || data.patient.chiefComplaint || "Consultation finalized."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/consultations/${id}/report`} target="_blank">
            <Button variant="outline" size="sm" className="gap-1.5">
              <PrinterIcon className="h-3.5 w-3.5" />
              Export PDF
            </Button>
          </Link>
          {data.status === "reviewed" ? null : (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => markReviewedMut.mutate()}
              disabled={markReviewedMut.isPending}
            >
              {markReviewedMut.isPending ? (
                <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2Icon className="h-3.5 w-3.5" />
              )}
              Mark reviewed
            </Button>
          )}
        </div>
      </header>

      {/* Body — same primitives the live workspace uses, but read-only */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[184px_minmax(0,1.4fr)_minmax(0,1fr)]">
        <TimelineRail
          markers={adapted.timeline}
          elapsedSec={data.durationSec ?? 0}
          className="hidden h-[calc(100vh-260px)] lg:flex"
        />
        <TranscriptPane
          lines={adapted.transcript}
          activity="idle"
          className="h-[calc(100vh-260px)] min-h-[440px]"
        />
        <div className="flex flex-col gap-5">
          <SoapPane
            sections={adapted.soap}
            className="min-h-[300px] lg:h-[calc(60vh-160px)] lg:min-h-[280px]"
          />
          <ExtractionsPanel
            symptoms={adapted.symptoms}
            medications={adapted.medications}
            vitals={adapted.vitals}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── adapters ─────────────── */

interface AdaptedConsultation {
  transcript: TranscriptLine[];
  soap: SoapSection[];
  symptoms: Symptom[];
  medications: Medication[];
  timeline: TimelineMarker[];
  vitals: VitalReading[];
}

function adaptDetail(d: ConsultationDetail): AdaptedConsultation {
  // Make sure SOAP always has all four sections, in S/O/A/P order, even
  // if the AI never produced (say) Plan.
  const soapByLabel = new Map(d.soap.map((s) => [s.label, s]));
  const soap: SoapSection[] = (["S", "O", "A", "P"] as const).map((label) => {
    const row = soapByLabel.get(label);
    return {
      label,
      title: SOAP_TITLES[label],
      body: row?.body ?? "",
      confidence: row?.confidence ?? 0,
    };
  });

  return {
    transcript: d.transcript.map((t) => ({
      id: t.id,
      timestampSec: t.timestampSec,
      speaker: t.speaker,
      text: t.text,
    })),
    soap,
    symptoms: d.symptoms.map((s) => ({
      id: s.id,
      label: s.label,
      severity: s.severity,
      confidence: s.confidence,
    })),
    medications: d.medications.map((m) => ({
      id: m.id,
      name: m.name,
      dose: m.dose ?? undefined,
      frequency: m.frequency ?? undefined,
      status: m.status,
    })),
    timeline: d.timeline.map((t) => ({
      id: t.id,
      timestampSec: t.timestampSec,
      label: t.label,
      kind: t.kind,
    })),
    vitals: [],
  };
}

function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[184px_minmax(0,1.4fr)_minmax(0,1fr)]">
        <Skeleton className="hidden h-[calc(100vh-260px)] rounded-xl lg:block" />
        <Skeleton className="h-[calc(100vh-260px)] min-h-[440px] rounded-xl" />
        <div className="flex flex-col gap-5">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[260px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
