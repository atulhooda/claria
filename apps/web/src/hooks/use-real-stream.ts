"use client";

import * as React from "react";

import { useRecorder } from "@/hooks/use-recorder";
import {
  useConsultationStream,
  type ServerEvent,
  type AiActivityState,
} from "@/hooks/use-consultation-stream";
import type {
  Medication,
  SoapSection,
  Symptom,
  TimelineMarker,
  TranscriptLine,
} from "@/lib/mocks/consultation";

/**
 * Real-data analogue of `useMockStream`. Returns the same shape so the
 * workspace UI consumes either implementation interchangeably.
 *
 * Inputs:
 *   - microphone audio via useRecorder (Phase 1)
 *
 * Server-side events folded into state:
 *   - transcript.partial / transcript.final → transcript list
 *   - extraction.symptom → symptoms list (dedupe by id, last-write-wins)
 *   - extraction.medication → medications list
 *   - timeline.add → timeline list
 *   - soap.update → soap[section] body + confidence
 *   - summary.update → headline (exposed; not yet rendered by workspace)
 */

const PARTIAL_LINE_ID = "live-partial";

const EMPTY_SOAP_SCAFFOLD: SoapSection[] = [
  { label: "S", title: "Subjective", body: "", confidence: 0 },
  { label: "O", title: "Objective", body: "", confidence: 0 },
  { label: "A", title: "Assessment", body: "", confidence: 0 },
  { label: "P", title: "Plan", body: "", confidence: 0 },
];

export interface UseRealStreamOptions {
  consultationId: string;
  autoConnect?: boolean;
}

export interface RealStreamReturn {
  // Mirror of `useMockStream`'s shape.
  elapsedSec: number;
  transcript: TranscriptLine[];
  timeline: TimelineMarker[];
  symptoms: Symptom[];
  medications: Medication[];
  soap: SoapSection[];
  activity: AiActivityState;
  complete: boolean;
  playing: boolean;

  start: () => Promise<void>;
  pause: () => void;
  reset: () => Promise<void>;

  // Real-stream-specific status.
  recorderState: ReturnType<typeof useRecorder>["state"];
  recorderError: string | null;
  connectionState: ReturnType<typeof useConsultationStream>["state"];
  connectionError: string | null;
  requestMicPermission: () => Promise<boolean>;
  /** AI headline summary — surfaced for future header display. */
  summary: string;
}

export function useRealStream(options: UseRealStreamOptions): RealStreamReturn {
  const { consultationId, autoConnect = true } = options;

  const [finals, setFinals] = React.useState<TranscriptLine[]>([]);
  const [partial, setPartial] = React.useState<TranscriptLine | null>(null);
  const [activity, setActivity] = React.useState<AiActivityState>("idle");

  // AI-driven state. Symptoms and meds keyed by id (server is the dedupe
  // authority); a re-emit with the same id overwrites the entry.
  const [symptomsById, setSymptomsById] = React.useState<
    Record<string, Symptom>
  >({});
  const [medicationsById, setMedicationsById] = React.useState<
    Record<string, Medication>
  >({});
  const [timeline, setTimeline] = React.useState<TimelineMarker[]>([]);
  const [soap, setSoap] = React.useState<SoapSection[]>(EMPTY_SOAP_SCAFFOLD);
  const [summary, setSummary] = React.useState<string>("");

  const handleEvent = React.useCallback((event: ServerEvent) => {
    switch (event.type) {
      case "ai.activity":
        setActivity(event.state);
        return;
      case "transcript.partial":
        setPartial({
          id: PARTIAL_LINE_ID,
          timestampSec: event.t,
          speaker: event.speaker,
          text: event.text,
        });
        return;
      case "transcript.final":
        setFinals((prev) => [
          ...prev,
          {
            id: event.id,
            timestampSec: event.t,
            speaker: event.speaker,
            text: event.text,
          },
        ]);
        setPartial(null);
        return;
      case "extraction.symptom":
        setSymptomsById((prev) => ({
          ...prev,
          [event.id]: {
            id: event.id,
            label: event.label,
            severity: event.severity,
            confidence: event.confidence,
          },
        }));
        return;
      case "extraction.medication":
        setMedicationsById((prev) => ({
          ...prev,
          [event.id]: {
            id: event.id,
            name: event.name,
            dose: event.dose ?? undefined,
            frequency: event.frequency ?? undefined,
            status: event.status,
          },
        }));
        return;
      case "timeline.add":
        setTimeline((prev) => {
          if (prev.some((m) => m.id === event.id)) return prev;
          return [
            ...prev,
            {
              id: event.id,
              timestampSec: event.t,
              label: event.label,
              kind: event.kind,
            },
          ];
        });
        return;
      case "soap.update":
        setSoap((prev) =>
          prev.map((s) =>
            s.label === event.section
              ? { ...s, body: event.body, confidence: event.confidence }
              : s,
          ),
        );
        return;
      case "summary.update":
        setSummary(event.text);
        return;
      // ready + error handled at the connection level.
    }
  }, []);

  const ws = useConsultationStream({
    consultationId,
    autoConnect,
    onEvent: handleEvent,
  });

  const recorder = useRecorder({
    onChunk: (chunk) => {
      ws.sendAudio(chunk);
    },
  });

  const transcript = React.useMemo<TranscriptLine[]>(() => {
    if (!partial) return finals;
    return [...finals, partial];
  }, [finals, partial]);

  // Stable insertion order for the symptoms / medications panels.
  const symptoms = React.useMemo(
    () => Object.values(symptomsById),
    [symptomsById],
  );
  const medications = React.useMemo(
    () => Object.values(medicationsById),
    [medicationsById],
  );

  const derivedActivity: AiActivityState =
    recorder.state === "recording" || recorder.state === "paused"
      ? activity
      : "idle";

  const start = React.useCallback(async (): Promise<void> => {
    if (ws.state === "idle" || ws.state === "closed" || ws.state === "error") {
      await ws.connect();
    }
    await recorder.start();
  }, [recorder, ws]);

  const pause = React.useCallback((): void => {
    recorder.pause();
    ws.sendControl("pause");
  }, [recorder, ws]);

  const reset = React.useCallback(async (): Promise<void> => {
    ws.sendControl("finalize");
    await recorder.stop();
    setFinals([]);
    setPartial(null);
    setActivity("idle");
    setSymptomsById({});
    setMedicationsById({});
    setTimeline([]);
    setSoap(EMPTY_SOAP_SCAFFOLD);
    setSummary("");
  }, [recorder, ws]);

  return {
    elapsedSec: recorder.elapsedSec,
    transcript,
    timeline,
    symptoms,
    medications,
    soap,
    activity: derivedActivity,
    complete: false,
    playing: recorder.state === "recording",

    start,
    pause,
    reset,

    recorderState: recorder.state,
    recorderError: recorder.error,
    connectionState: ws.state,
    connectionError: ws.error,
    requestMicPermission: recorder.requestPermission,
    summary,
  };
}
