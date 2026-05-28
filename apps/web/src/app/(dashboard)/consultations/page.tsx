"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  CircleDotIcon,
  Loader2Icon,
  MicIcon,
  PlayCircleIcon,
  PlusIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  sampleConsultation,
  SAMPLE_CONSULTATION_ID,
} from "@/lib/mocks/consultation";
import {
  useConsultationsList,
  useCreateConsultation,
  type ConsultationStatus,
  type ConsultationSummary,
} from "@/lib/api/consultations";

export default function ConsultationsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useConsultationsList();
  const createMut = useCreateConsultation();

  const startLiveConsultation = React.useCallback(async () => {
    const created = await createMut.mutateAsync();
    router.push(`/consultations/${created.id}`);
  }, [createMut, router]);

  const sessions = data ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Consultations
          </h1>
          <p className="text-sm text-muted-foreground">
            All recorded consultations, transcripts, and generated notes live
            here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/consultations/${SAMPLE_CONSULTATION_ID}`}>
            <Button size="sm" variant="outline" className="gap-1.5">
              <PlayCircleIcon className="h-4 w-4" />
              Open demo
            </Button>
          </Link>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={startLiveConsultation}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? (
              <Loader2Icon className="h-4 w-4 animate-spin" />
            ) : (
              <PlusIcon className="h-4 w-4" />
            )}
            Start live consultation
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : sessions.length === 0 ? (
        <EmptyState onStart={startLiveConsultation} starting={createMut.isPending} />
      ) : (
        <ConsultationsTable sessions={sessions} />
      )}
    </div>
  );
}

/* ─────────────── states ─────────────── */

function ConsultationsTable({ sessions }: { sessions: ConsultationSummary[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-elevated">
      <div className="grid grid-cols-[1.4fr_1fr_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Patient</span>
        <span>Summary</span>
        <span>Duration</span>
        <span>Status</span>
        <span className="w-6" />
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {/* Always-on demo row, kept above real consultations and obviously
            marked so it's never confused with a real patient session. */}
        <li>
          <Link
            href={`/consultations/${SAMPLE_CONSULTATION_ID}`}
            className="group grid grid-cols-[1.4fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60"
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-foreground">
                {sampleConsultation.patient.name}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {sampleConsultation.patient.mrn} · {sampleConsultation.patient.age}{" "}
                {sampleConsultation.patient.pronouns}
              </span>
            </div>
            <span className="truncate text-sm text-foreground/85">
              {sampleConsultation.patient.chiefComplaint}
            </span>
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              —
            </span>
            <Badge variant="muted" className="uppercase">
              Demo
            </Badge>
            <ArrowUpRightIcon className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
          </Link>
        </li>

        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={
                s.status === "live"
                  ? `/consultations/${s.id}`
                  : `/consultations/${s.id}/review`
              }
              className="group grid grid-cols-[1.4fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-foreground">
                  {s.patient.name || "Untitled consultation"}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {formatStartedAt(s.startedAt)}
                </span>
              </div>
              <span className="truncate text-sm text-foreground/85">
                {s.summary || s.patient.chiefComplaint || "—"}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {formatDuration(s.durationSec)}
              </span>
              <StatusBadge status={s.status} />
              <ArrowUpRightIcon className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: ConsultationStatus }) {
  if (status === "live") {
    return (
      <Badge variant="accent" className="gap-1.5">
        <CircleDotIcon className="h-3 w-3 text-destructive" strokeWidth={2.4} />
        Live
      </Badge>
    );
  }
  if (status === "reviewed") {
    return <Badge variant="muted">Reviewed</Badge>;
  }
  return <Badge variant="outline">Completed</Badge>;
}

function EmptyState({
  onStart,
  starting,
}: {
  onStart: () => void;
  starting: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-border bg-pane-gradient px-10 py-14 text-center shadow-pane">
      <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <MicIcon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <h2 className="text-lg font-semibold tracking-tight text-foreground">
        No consultations yet
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Start a live consultation and Claria will record, transcribe, and
        draft the clinical note as you talk to your patient.
      </p>
      <Button
        size="lg"
        className="mt-7 gap-2"
        onClick={onStart}
        disabled={starting}
      >
        {starting ? (
          <Loader2Icon className="h-4 w-4 animate-spin" />
        ) : (
          <PlusIcon className="h-4 w-4" />
        )}
        Start your first consultation
      </Button>
      <p className="mt-5 text-[11px] text-muted-foreground">
        Or{" "}
        <Link
          href={`/consultations/${SAMPLE_CONSULTATION_ID}`}
          className="underline underline-offset-2 hover:text-foreground"
        >
          open the demo
        </Link>{" "}
        to see what the workspace looks like with sample data.
      </p>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive">
      Could not load consultations: {message}
    </div>
  );
}

/* ─────────────── format helpers ─────────────── */

function formatDuration(sec: number | null): string {
  if (sec === null || sec === undefined) return "—";
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

function formatStartedAt(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
