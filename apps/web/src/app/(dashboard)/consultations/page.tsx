"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  CircleDotIcon,
  Loader2Icon,
  MicIcon,
  PlayCircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NewConsultationDialog } from "@/components/consultations/new-consultation-dialog";
import {
  sampleConsultation,
  SAMPLE_CONSULTATION_ID,
} from "@/lib/mocks/consultation";
import {
  useConsultationsList,
  useDeleteConsultation,
  type ConsultationStatus,
  type ConsultationSummary,
} from "@/lib/api/consultations";

export default function ConsultationsPage() {
  const { data, isLoading, error } = useConsultationsList();
  const [dialogOpen, setDialogOpen] = React.useState(false);

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
            onClick={() => setDialogOpen(true)}
          >
            <PlusIcon className="h-4 w-4" />
            Start live consultation
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState message={error.message} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : sessions.length === 0 ? (
        <EmptyState onStart={() => setDialogOpen(true)} />
      ) : (
        <ConsultationsTable sessions={sessions} />
      )}

      <NewConsultationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

/* ─────────────── states ─────────────── */

function ConsultationsTable({ sessions }: { sessions: ConsultationSummary[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-1 shadow-elevated">
      <div className="grid grid-cols-[1.4fr_1fr_auto_auto_auto_auto] items-center gap-4 border-b border-border px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Patient</span>
        <span>Summary</span>
        <span>Duration</span>
        <span>Status</span>
        <span className="w-4" />
        <span className="w-8" />
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {/* Always-on demo row, kept above real consultations and obviously
            marked so it's never confused with a real patient session. */}
        <li>
          <Link
            href={`/consultations/${SAMPLE_CONSULTATION_ID}`}
            className="group grid grid-cols-[1.4fr_1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2/60"
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
            <span className="w-8" />
          </Link>
        </li>

        {sessions.map((s) => (
          <ConsultationRow key={s.id} session={s} />
        ))}
      </ul>
    </div>
  );
}

function ConsultationRow({ session }: { session: ConsultationSummary }) {
  const href =
    session.status === "live"
      ? `/consultations/${session.id}`
      : `/consultations/${session.id}/review`;
  const label = session.patient.name || "Untitled consultation";

  return (
    <li className="group relative transition-colors hover:bg-surface-2/60">
      {/* Stretched link covers the whole row so anywhere outside the trash
          button still navigates. The action cell sits above it with z-10. */}
      <Link
        href={href}
        aria-label={`Open consultation for ${label}`}
        className="absolute inset-0 z-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      />
      <div className="pointer-events-none relative z-10 grid grid-cols-[1.4fr_1fr_auto_auto_auto_auto] items-center gap-4 px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {formatStartedAt(session.startedAt)}
          </span>
        </div>
        <span className="truncate text-sm text-foreground/85">
          {session.summary || session.patient.chiefComplaint || "—"}
        </span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {formatDuration(session.durationSec)}
        </span>
        <StatusBadge status={session.status} />
        <ArrowUpRightIcon className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
        <DeleteRowButton id={session.id} label={label} />
      </div>
    </li>
  );
}

function DeleteRowButton({ id, label }: { id: string; label: string }) {
  const [confirming, setConfirming] = React.useState(false);
  const deleteMut = useDeleteConsultation();

  // Auto-collapse the confirm state if the user clicks elsewhere in the row.
  React.useEffect(() => {
    if (!confirming) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target && !target.closest("[data-delete-row]")) {
        setConfirming(false);
      }
    };
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [confirming]);

  if (confirming) {
    return (
      <div className="pointer-events-auto flex items-center gap-1" data-delete-row>
        <Button
          size="sm"
          variant="ghost"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setConfirming(false);
          }}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={deleteMut.isPending}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteMut.mutate(id, {
              onSettled: () => setConfirming(false),
            });
          }}
        >
          {deleteMut.isPending ? (
            <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
          ) : (
            "Delete"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto" data-delete-row>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive"
            aria-label={`Delete consultation for ${label}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setConfirming(true);
            }}
          >
            <Trash2Icon className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete consultation</TooltipContent>
      </Tooltip>
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

function EmptyState({ onStart }: { onStart: () => void }) {
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
      <Button size="lg" className="mt-7 gap-2" onClick={onStart}>
        <PlusIcon className="h-4 w-4" />
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
