"use client";

import * as React from "react";

export type RecorderState =
  | "idle"
  | "requesting-permission"
  | "permission-denied"
  | "ready"
  | "recording"
  | "paused"
  | "error";

export interface UseRecorderOptions {
  /** Sample rate the backend / STT provider expects. */
  targetSampleRate?: number;
  /** Approximate chunk size in ms. 250 keeps latency low while batching enough. */
  chunkMs?: number;
  /** Fires for every PCM Int16 chunk produced by the worklet. */
  onChunk?: (chunk: ArrayBuffer) => void;
  /** Path to the worklet module relative to the site root. */
  workletUrl?: string;
}

export interface UseRecorderReturn {
  state: RecorderState;
  error: string | null;
  /** 0–1 RMS level for the waveform — sampled from the live stream. */
  level: number;
  /** Seconds elapsed across the recording (paused time excluded). */
  elapsedSec: number;

  requestPermission: () => Promise<boolean>;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
}

const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_CHUNK_MS = 250;
const DEFAULT_WORKLET_URL = "/worklets/pcm-downsampler.js";

/**
 * One-stop recorder hook. Owns the entire audio capture lifecycle:
 *   1. Asks for mic permission (idempotent).
 *   2. Boots an `AudioContext` + `AudioWorkletNode` that downsamples to
 *      16 kHz Int16 mono and posts chunks via `onChunk`.
 *   3. Maintains a 0–1 level reading via `AnalyserNode` (RMS) for the
 *      waveform / mic UI.
 *   4. Tracks elapsed recording time, pausing the counter on pause.
 *   5. Cleans up everything on unmount or `stop()`.
 *
 * This hook is deliberately transport-agnostic: it doesn't know about
 * WebSockets, our backend, or Deepgram. Compose it with the WS hook to
 * make a real session.
 */
export function useRecorder(options: UseRecorderOptions = {}): UseRecorderReturn {
  const {
    targetSampleRate = DEFAULT_SAMPLE_RATE,
    chunkMs = DEFAULT_CHUNK_MS,
    onChunk,
    workletUrl = DEFAULT_WORKLET_URL,
  } = options;

  const [state, setState] = React.useState<RecorderState>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [level, setLevel] = React.useState(0);
  const [elapsedSec, setElapsedSec] = React.useState(0);

  // Keep the latest `onChunk` callback in a ref so the worklet handler
  // doesn't need to be reattached when a parent re-renders.
  const onChunkRef = React.useRef(onChunk);
  React.useEffect(() => {
    onChunkRef.current = onChunk;
  }, [onChunk]);

  // Pieces of the audio graph — refs so we can tear them down cleanly.
  const streamRef = React.useRef<MediaStream | null>(null);
  const contextRef = React.useRef<AudioContext | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const workletRef = React.useRef<AudioWorkletNode | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const levelRafRef = React.useRef<number | null>(null);

  // Elapsed-time bookkeeping. We accumulate paused segments rather than
  // running a ticker, so pausing doesn't drift.
  const elapsedBaseMsRef = React.useRef(0);
  const segmentStartMsRef = React.useRef<number | null>(null);
  const elapsedRafRef = React.useRef<number | null>(null);

  // --- mic level sampling ---

  const startLevelLoop = React.useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buffer = new Float32Array(analyser.fftSize);
    const tick = () => {
      analyser.getFloatTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        sumSquares += buffer[i]! * buffer[i]!;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      // Compress dynamic range so the meter feels lively, not pegged.
      const compressed = Math.min(1, Math.pow(rms, 0.7) * 2.4);
      setLevel(compressed);
      levelRafRef.current = requestAnimationFrame(tick);
    };
    levelRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopLevelLoop = React.useCallback(() => {
    if (levelRafRef.current !== null) {
      cancelAnimationFrame(levelRafRef.current);
      levelRafRef.current = null;
    }
    setLevel(0);
  }, []);

  // --- elapsed-time sampling ---

  const startElapsedLoop = React.useCallback(() => {
    segmentStartMsRef.current = performance.now();
    const tick = () => {
      const start = segmentStartMsRef.current;
      if (start === null) return;
      const liveMs = performance.now() - start;
      setElapsedSec((elapsedBaseMsRef.current + liveMs) / 1000);
      elapsedRafRef.current = requestAnimationFrame(tick);
    };
    elapsedRafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopElapsedLoop = React.useCallback((freeze = false) => {
    if (elapsedRafRef.current !== null) {
      cancelAnimationFrame(elapsedRafRef.current);
      elapsedRafRef.current = null;
    }
    const start = segmentStartMsRef.current;
    if (freeze && start !== null) {
      elapsedBaseMsRef.current += performance.now() - start;
    }
    segmentStartMsRef.current = null;
  }, []);

  // --- teardown ---

  const teardown = React.useCallback(() => {
    stopLevelLoop();
    stopElapsedLoop(true);
    workletRef.current?.port?.close?.();
    workletRef.current?.disconnect();
    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    if (contextRef.current && contextRef.current.state !== "closed") {
      contextRef.current.close().catch(() => undefined);
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    workletRef.current = null;
    sourceRef.current = null;
    analyserRef.current = null;
    contextRef.current = null;
    streamRef.current = null;
  }, [stopElapsedLoop, stopLevelLoop]);

  React.useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  // --- permissions ---

  const requestPermission = React.useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Microphone API unavailable in this browser.");
      setState("error");
      return false;
    }
    setState("requesting-permission");
    setError(null);
    try {
      // Probe the permission; we don't keep the stream — `start()` will
      // request it again (cheap once permission is granted).
      const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
      probe.getTracks().forEach((t) => t.stop());
      setState("ready");
      return true;
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : "Could not access the microphone.";
      setError(message);
      setState("permission-denied");
      return false;
    }
  }, []);

  // --- start / pause / resume / stop ---

  const start = React.useCallback(async (): Promise<void> => {
    if (state === "recording") return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const Ctx: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = new Ctx();
      contextRef.current = context;

      await context.audioWorklet.addModule(workletUrl);

      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      analyserRef.current = analyser;
      source.connect(analyser);

      const worklet = new AudioWorkletNode(context, "pcm-downsampler", {
        processorOptions: { targetSampleRate, chunkMs },
      });
      worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        onChunkRef.current?.(event.data);
      };
      workletRef.current = worklet;
      source.connect(worklet);
      // We don't connect to destination — audio doesn't need to play back.

      elapsedBaseMsRef.current = 0;
      startElapsedLoop();
      startLevelLoop();

      setState("recording");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone permission was denied."
          : err instanceof Error
            ? err.message
            : "Could not start the recording.";
      setError(message);
      setState("error");
      teardown();
    }
  }, [chunkMs, startElapsedLoop, startLevelLoop, state, targetSampleRate, teardown, workletUrl]);

  const pause = React.useCallback((): void => {
    if (state !== "recording") return;
    workletRef.current?.port.postMessage({ muted: true });
    stopElapsedLoop(true);
    stopLevelLoop();
    setState("paused");
  }, [state, stopElapsedLoop, stopLevelLoop]);

  const resume = React.useCallback(async (): Promise<void> => {
    if (state !== "paused") return;
    workletRef.current?.port.postMessage({ muted: false });
    startElapsedLoop();
    startLevelLoop();
    setState("recording");
  }, [startElapsedLoop, startLevelLoop, state]);

  const stop = React.useCallback(async (): Promise<void> => {
    teardown();
    elapsedBaseMsRef.current = 0;
    setElapsedSec(0);
    setState("idle");
  }, [teardown]);

  return {
    state,
    error,
    level,
    elapsedSec,
    requestPermission,
    start,
    pause,
    resume,
    stop,
  };
}
