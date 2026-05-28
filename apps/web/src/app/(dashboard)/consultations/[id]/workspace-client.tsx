"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { useMockStream } from "@/hooks/use-mock-stream";
import { useRealStream } from "@/hooks/use-real-stream";
import { WorkspaceHeader } from "@/components/workspace/workspace-header";
import { TranscriptPane } from "@/components/workspace/transcript-pane";
import { SoapPane } from "@/components/workspace/soap-pane";
import { ExtractionsPanel } from "@/components/workspace/extractions-panel";
import { TimelineRail } from "@/components/workspace/timeline-rail";
import { RecordingBar } from "@/components/workspace/recording-bar";
import { MicPermissionGate } from "@/components/workspace/mic-permission-gate";
import type { AiActivity } from "@/hooks/use-mock-stream";
import type { ConnectionState } from "@/hooks/use-consultation-stream";
import type {
  Medication,
  MockConsultation,
  SoapSection,
  Symptom,
  TimelineMarker,
  TranscriptLine,
  VitalReading,
} from "@/lib/mocks/consultation";

interface WorkspaceClientProps {
  consultation: MockConsultation;
  mode: "mock" | "live";
}

/**
 * Client shell for the consultation workspace.
 *
 * Two data sources, identical UI:
 *   - mode="mock" → `useMockStream`, drives the cinematic demo with the
 *     hardcoded Eleanor Whitford fixture (untouched by this phase).
 *   - mode="live" → `useRealStream`, real microphone + WebSocket +
 *     Deepgram pipeline. Renders a permission gate first; the workspace
 *     itself only mounts once mic access is granted.
 */
export function WorkspaceClient({ consultation, mode }: WorkspaceClientProps) {
  if (mode === "live") {
    return <LiveWorkspace consultation={consultation} />;
  }
  return <MockWorkspace consultation={consultation} />;
}

function MockWorkspace({ consultation }: { consultation: MockConsultation }) {
  const stream = useMockStream(consultation, { speed: 4, autoStart: true });
  return (
    <WorkspaceLayout
      consultation={consultation}
      stream={{
        elapsedSec: stream.elapsedSec,
        transcript: stream.transcript,
        timeline: stream.timeline,
        symptoms: stream.symptoms,
        medications: stream.medications,
        soap: stream.soap,
        activity: stream.activity,
        playing: stream.playing,
      }}
      vitals={consultation.vitals}
      onPlayToggle={stream.playing ? stream.pause : stream.start}
      onStop={stream.reset}
    />
  );
}

function LiveWorkspace({ consultation }: { consultation: MockConsultation }) {
  const router = useRouter();
  const stream = useRealStream({ consultationId: consultation.id });

  const handleStop = React.useCallback(async () => {
    await stream.reset();
    // Backend marks the row `completed` when the WS closes; the review
    // page reads the persisted final state.
    router.push(`/consultations/${consultation.id}/review`);
  }, [consultation.id, router, stream]);

  const showGate =
    stream.recorderState === "idle" ||
    stream.recorderState === "requesting-permission" ||
    stream.recorderState === "permission-denied" ||
    stream.recorderState === "error";

  return (
    <div className="relative flex flex-col gap-5">
      <BackdropOrbs />

      <div className="relative z-10 flex flex-col gap-5">
        <WorkspaceHeader
          patient={consultation.patient}
          sessionId={consultation.id}
          activity={stream.activity}
          status={consultation.status}
        />

        {/* Connection-state banner — non-fatal warnings while the WS reconnects. */}
        {stream.connectionState === "connecting" ||
        stream.connectionState === "closed" ||
        stream.connectionError ? (
          <ConnectionBanner
            state={stream.connectionState}
            error={stream.connectionError}
          />
        ) : null}

        {showGate ? (
          <MicPermissionGate
            state={stream.recorderState}
            error={stream.recorderError}
            onRequest={async () => {
              const ok = await stream.requestMicPermission();
              if (ok) await stream.start();
            }}
          />
        ) : (
          <WorkspacePanes
            stream={{
              elapsedSec: stream.elapsedSec,
              transcript: stream.transcript,
              timeline: stream.timeline,
              symptoms: stream.symptoms,
              medications: stream.medications,
              soap: stream.soap,
              activity: stream.activity,
            }}
            vitals={consultation.vitals}
          />
        )}

        <RecordingBar
          elapsedSec={stream.elapsedSec}
          playing={stream.playing}
          onPlayToggle={
            stream.playing ? stream.pause : () => void stream.start()
          }
          onStop={() => void handleStop()}
          className="sticky bottom-4 z-20"
        />
      </div>
    </div>
  );
}

/* ─────────────────────── shared layout primitives ─────────────────────── */

interface SharedStream {
  elapsedSec: number;
  transcript: TranscriptLine[];
  timeline: TimelineMarker[];
  symptoms: Symptom[];
  medications: Medication[];
  soap: SoapSection[];
  activity: AiActivity;
  playing: boolean;
}

interface WorkspaceLayoutProps {
  consultation: MockConsultation;
  stream: SharedStream;
  vitals: VitalReading[];
  onPlayToggle: () => void;
  onStop: () => void;
}

function WorkspaceLayout({
  consultation,
  stream,
  vitals,
  onPlayToggle,
  onStop,
}: WorkspaceLayoutProps) {
  return (
    <div className="relative flex flex-col gap-5">
      <BackdropOrbs />

      <div className="relative z-10 flex flex-col gap-5">
        <WorkspaceHeader
          patient={consultation.patient}
          sessionId={consultation.id}
          activity={stream.activity}
          status={consultation.status}
        />

        <WorkspacePanes
          stream={{
            elapsedSec: stream.elapsedSec,
            transcript: stream.transcript,
            timeline: stream.timeline,
            symptoms: stream.symptoms,
            medications: stream.medications,
            soap: stream.soap,
            activity: stream.activity,
          }}
          vitals={vitals}
        />

        <RecordingBar
          elapsedSec={stream.elapsedSec}
          playing={stream.playing}
          onPlayToggle={onPlayToggle}
          onStop={onStop}
          className="sticky bottom-4 z-20"
        />
      </div>
    </div>
  );
}

interface WorkspacePanesProps {
  stream: Omit<SharedStream, "playing">;
  vitals: VitalReading[];
}

function WorkspacePanes({ stream, vitals }: WorkspacePanesProps) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[184px_minmax(0,1.4fr)_minmax(0,1fr)]">
      <TimelineRail
        markers={stream.timeline}
        elapsedSec={stream.elapsedSec}
        className="hidden h-[calc(100vh-300px)] lg:flex"
      />
      <TranscriptPane
        lines={stream.transcript}
        activity={stream.activity}
        className="h-[calc(100vh-300px)] min-h-[440px]"
      />
      <div className="flex flex-col gap-5">
        <SoapPane
          sections={stream.soap}
          className="min-h-[300px] lg:h-[calc(60vh-180px)] lg:min-h-[280px]"
        />
        <ExtractionsPanel
          symptoms={stream.symptoms}
          medications={stream.medications}
          vitals={vitals}
        />
      </div>
    </div>
  );
}

function BackdropOrbs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-10 -bottom-6 -z-0 overflow-hidden"
    >
      <span className="absolute -top-20 left-1/4 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-primary/[0.045] blur-3xl animate-ambient-drift" />
      <span
        className="absolute -top-12 right-0 h-[360px] w-[520px] rounded-full bg-primary/[0.035] blur-3xl animate-ambient-drift"
        style={{ animationDelay: "-7s" }}
      />
    </div>
  );
}

function ConnectionBanner({
  state,
  error,
}: {
  state: ConnectionState;
  error: string | null;
}) {
  const label =
    state === "connecting"
      ? "Connecting to transcription service…"
      : state === "closed"
        ? "Connection closed — reconnecting…"
        : error || "Connection issue.";
  const tone =
    error || state === "closed"
      ? "border-destructive/30 bg-destructive/5 text-destructive"
      : "border-border bg-surface-2 text-muted-foreground";
  return (
    <div
      className={`flex items-center justify-between rounded-md border px-4 py-2 text-[12px] font-medium ${tone}`}
    >
      <span>{label}</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] opacity-70">
        {state}
      </span>
    </div>
  );
}
