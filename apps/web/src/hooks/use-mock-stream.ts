"use client";

import * as React from "react";

import type {
  MockConsultation,
  Symptom,
  Medication,
  SoapSection,
  TimelineMarker,
  TranscriptLine,
} from "@/lib/mocks/consultation";

export type AiActivity = "idle" | "listening" | "transcribing" | "drafting";

export interface MockStreamState {
  /** Seconds since the user "started" the session. */
  elapsedSec: number;
  /** Transcript lines revealed so far, in order. */
  transcript: TranscriptLine[];
  /** Timeline markers revealed so far. */
  timeline: TimelineMarker[];
  /** Symptoms / medications surface as the transcript progresses. */
  symptoms: Symptom[];
  medications: Medication[];
  /** SOAP sections fill in progressively; confidence rises with each line. */
  soap: SoapSection[];
  /** What the AI is "doing" right now — drives the status pill. */
  activity: AiActivity;
  /** True once every transcript line has been revealed. */
  complete: boolean;
}

interface UseMockStreamOptions {
  /** Speed multiplier — 1× plays in real time; 4× is good for demos. */
  speed?: number;
  /** Start automatically on mount. */
  autoStart?: boolean;
}

/**
 * Fakes a live consultation stream from a static fixture. Reveals
 * transcript lines on their scheduled timestamps, surfaces extractions
 * shortly after each line lands, and toggles the AI activity state
 * through listening → transcribing → drafting → idle.
 */
export function useMockStream(
  consultation: MockConsultation,
  { speed = 4, autoStart = true }: UseMockStreamOptions = {},
): MockStreamState & {
  start: () => void;
  pause: () => void;
  reset: () => void;
  playing: boolean;
} {
  const [elapsedSec, setElapsedSec] = React.useState(0);
  const [playing, setPlaying] = React.useState(autoStart);
  const [activity, setActivity] = React.useState<AiActivity>("listening");

  // Tick once per ~250ms real time, advancing virtual time by speed * 0.25s.
  React.useEffect(() => {
    if (!playing) return;
    const totalSec =
      consultation.transcript[consultation.transcript.length - 1]?.timestampSec ?? 0;

    const interval = setInterval(() => {
      setElapsedSec((prev) => {
        const next = prev + 0.25 * speed;
        return next > totalSec + 8 ? totalSec + 8 : next;
      });
    }, 250);
    return () => clearInterval(interval);
  }, [playing, speed, consultation]);

  // Derive what's "revealed" based on elapsed time.
  const transcript = React.useMemo(
    () => consultation.transcript.filter((l) => l.timestampSec <= elapsedSec),
    [consultation.transcript, elapsedSec],
  );
  const timeline = React.useMemo(
    () => consultation.timeline.filter((m) => m.timestampSec <= elapsedSec),
    [consultation.timeline, elapsedSec],
  );

  // Symptoms / meds surface as their first mention is transcribed.
  const linesCount = transcript.length;
  const symptoms = React.useMemo(() => {
    const count = Math.min(
      consultation.symptoms.length,
      Math.max(0, Math.floor(linesCount / 1.5)),
    );
    return consultation.symptoms.slice(0, count);
  }, [consultation.symptoms, linesCount]);
  const medications = React.useMemo(() => {
    const count = Math.min(
      consultation.medications.length,
      Math.max(0, Math.floor((linesCount - 4) / 1.2)),
    );
    return consultation.medications.slice(0, Math.max(0, count));
  }, [consultation.medications, linesCount]);

  // SOAP confidence grows as more transcript accumulates.
  const totalLines = consultation.transcript.length;
  const soap = React.useMemo<SoapSection[]>(() => {
    const progress = totalLines === 0 ? 0 : linesCount / totalLines;
    return consultation.soap.map((s, i) => {
      // Earlier sections (S, O) fill in first; later sections (A, P) lag.
      const sectionProgress = Math.max(0, Math.min(1, progress * (1.5 - i * 0.18)));
      return {
        ...s,
        confidence: Number((s.confidence * sectionProgress).toFixed(2)),
      };
    });
  }, [consultation.soap, linesCount, totalLines]);

  // Activity heuristic: cycle between transcribing / drafting after each line.
  React.useEffect(() => {
    if (!playing) {
      setActivity("idle");
      return;
    }
    if (linesCount === 0) {
      setActivity("listening");
      return;
    }
    setActivity("transcribing");
    const t = setTimeout(() => setActivity("drafting"), 600);
    const t2 = setTimeout(() => setActivity("listening"), 1600);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [linesCount, playing]);

  const complete = linesCount >= totalLines;

  return {
    elapsedSec,
    transcript,
    timeline,
    symptoms,
    medications,
    soap,
    activity: complete ? "idle" : activity,
    complete,
    playing,
    start: React.useCallback(() => setPlaying(true), []),
    pause: React.useCallback(() => setPlaying(false), []),
    reset: React.useCallback(() => {
      setElapsedSec(0);
      setPlaying(autoStart);
    }, [autoStart]),
  };
}
