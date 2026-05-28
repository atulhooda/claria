"use client";

import * as React from "react";

import { clientEnv } from "@/lib/env";
import { getClientToken } from "@/lib/api/auth";

/* ─── Wire format: mirrors apps/api/app/services/deepgram_stream.py ─── */

export type Speaker = "doctor" | "patient";

export type AiActivityState =
  | "idle"
  | "listening"
  | "transcribing"
  | "drafting";

export interface ReadyEvent {
  type: "ready";
}

export interface ActivityEvent {
  type: "ai.activity";
  state: AiActivityState;
}

export interface TranscriptEvent {
  type: "transcript.partial" | "transcript.final";
  id: string;
  t: number;
  speaker: Speaker;
  text: string;
  confidence?: number;
}

export interface ServerErrorEvent {
  type: "error";
  code: string;
  message: string;
}

/* ─── AI pipeline events (mirror app/services/ai_orchestrator.py) ─── */

export type Severity = "mild" | "moderate" | "severe";
export type MedicationStatus = "current" | "prescribed" | "discontinued";
export type SoapLabel = "S" | "O" | "A" | "P";
export type TimelineKind = "topic" | "vital" | "medication" | "follow-up";

export interface SymptomEvent {
  type: "extraction.symptom";
  action: "add" | "update";
  id: string;
  label: string;
  severity: Severity;
  duration: string | null;
  confidence: number;
}

export interface MedicationEvent {
  type: "extraction.medication";
  action: "add" | "update";
  id: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  status: MedicationStatus;
  confidence: number;
}

export interface TimelineAddEvent {
  type: "timeline.add";
  id: string;
  t: number;
  label: string;
  kind: TimelineKind;
}

export interface SoapUpdateEvent {
  type: "soap.update";
  section: SoapLabel;
  body: string;
  confidence: number;
}

export interface SummaryUpdateEvent {
  type: "summary.update";
  text: string;
}

export type ServerEvent =
  | ReadyEvent
  | ActivityEvent
  | TranscriptEvent
  | ServerErrorEvent
  | SymptomEvent
  | MedicationEvent
  | TimelineAddEvent
  | SoapUpdateEvent
  | SummaryUpdateEvent;

export type ConnectionState =
  | "idle"
  | "connecting"
  | "open"
  | "closing"
  | "closed"
  | "error";

export interface UseConsultationStreamOptions {
  /** Consultation id used in the URL path. */
  consultationId: string;
  /** Automatically connect on mount. Default false — caller decides when. */
  autoConnect?: boolean;
  /** Called once per incoming server event. */
  onEvent?: (event: ServerEvent) => void;
  /** Reconnect on unexpected close (not on explicit close). Default true. */
  reconnect?: boolean;
}

export interface UseConsultationStreamReturn {
  state: ConnectionState;
  error: string | null;
  /** Open the socket. Idempotent if already open. */
  connect: () => Promise<void>;
  /** Close cleanly; suppresses auto-reconnect. */
  disconnect: () => void;
  /** Send a binary PCM chunk. No-op if not open. */
  sendAudio: (chunk: ArrayBuffer) => void;
  /** Send a control frame (pause/resume/finalize). */
  sendControl: (action: "pause" | "resume" | "finalize") => void;
}

const MAX_RECONNECT_DELAY_MS = 8000;
const BACKOFF_BASE_MS = 600;

/**
 * Maintains a WebSocket to /api/v1/consultations/{id}/stream.
 *
 * Responsibilities:
 *   - Build the URL by deriving `ws[s]://` from NEXT_PUBLIC_API_BASE_URL
 *   - Append `?token=` (Clerk JWT) for upgrade-time auth
 *   - Translate JSON text frames into typed `ServerEvent`s
 *   - Drop binary chunks gracefully if the socket is congested
 *   - Reconnect with exponential backoff on unexpected close
 */
export function useConsultationStream(
  options: UseConsultationStreamOptions,
): UseConsultationStreamReturn {
  const {
    consultationId,
    autoConnect = false,
    onEvent,
    reconnect = true,
  } = options;

  const [state, setState] = React.useState<ConnectionState>("idle");
  const [error, setError] = React.useState<string | null>(null);

  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = React.useRef(0);
  const reconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const explicitCloseRef = React.useRef(false);
  const onEventRef = React.useRef(onEvent);

  React.useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const buildUrl = React.useCallback(async (): Promise<string> => {
    const base = clientEnv.NEXT_PUBLIC_API_BASE_URL;
    // Convert http(s)://host/api/v1 → ws(s)://host/api/v1
    const wsBase = base.replace(/^http/, "ws");
    const token = (await getClientToken()) ?? "";
    const url = new URL(`${wsBase}/consultations/${consultationId}/stream`);
    if (token) url.searchParams.set("token", token);
    return url.toString();
  }, [consultationId]);

  const cancelReconnect = React.useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const scheduleReconnect = React.useCallback(
    (connectFn: () => Promise<void>) => {
      if (!reconnect || explicitCloseRef.current) return;
      const attempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = attempt;
      const delay = Math.min(
        MAX_RECONNECT_DELAY_MS,
        BACKOFF_BASE_MS * 2 ** Math.min(attempt - 1, 4),
      );
      reconnectTimerRef.current = setTimeout(() => {
        connectFn().catch(() => undefined);
      }, delay);
    },
    [reconnect],
  );

  const connect = React.useCallback(async (): Promise<void> => {
    if (wsRef.current && wsRef.current.readyState <= WebSocket.OPEN) return;

    setError(null);
    setState("connecting");
    explicitCloseRef.current = false;
    cancelReconnect();

    let url: string;
    try {
      url = await buildUrl();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build stream URL");
      setState("error");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "WebSocket construction failed");
      setState("error");
      return;
    }
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setState("open");
    };

    ws.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return; // server never sends binary
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!isServerEvent(parsed)) return;
      onEventRef.current?.(parsed);
    };

    ws.onerror = () => {
      // The error event itself is opaque; the close frame that follows
      // is what matters. Just surface it as state.
      setError("Connection error");
    };

    ws.onclose = (event: CloseEvent) => {
      wsRef.current = null;
      if (explicitCloseRef.current) {
        setState("closed");
        return;
      }
      // 4401 = unauthorized; don't auto-retry — caller must fix auth.
      if (event.code === 4401) {
        setError("Unauthorized — refresh and try again.");
        setState("error");
        return;
      }
      if (event.code === 4503) {
        setError(
          event.reason || "Transcription is unavailable on the server.",
        );
        setState("error");
        return;
      }
      setState("closed");
      scheduleReconnect(connect);
    };
  }, [buildUrl, cancelReconnect, scheduleReconnect]);

  const disconnect = React.useCallback(() => {
    explicitCloseRef.current = true;
    cancelReconnect();
    setState("closing");
    const ws = wsRef.current;
    if (ws && ws.readyState <= WebSocket.OPEN) {
      ws.close(1000, "client closed");
    }
  }, [cancelReconnect]);

  const sendAudio = React.useCallback((chunk: ArrayBuffer): void => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Backpressure: if the browser hasn't drained the previous send
    // queue, drop the new chunk rather than blowing up memory.
    if (ws.bufferedAmount > 1_000_000) return;
    ws.send(chunk);
  }, []);

  const sendControl = React.useCallback(
    (action: "pause" | "resume" | "finalize"): void => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: "control", action }));
    },
    [],
  );

  // Auto-connect on mount (opt-in).
  React.useEffect(() => {
    if (!autoConnect) return;
    connect().catch(() => undefined);
    return () => {
      explicitCloseRef.current = true;
      cancelReconnect();
      wsRef.current?.close(1000, "unmount");
      wsRef.current = null;
    };
  }, [autoConnect, cancelReconnect, connect]);

  // Always cancel reconnects + close on unmount.
  React.useEffect(() => {
    return () => {
      explicitCloseRef.current = true;
      cancelReconnect();
      wsRef.current?.close(1000, "unmount");
      wsRef.current = null;
    };
  }, [cancelReconnect]);

  return {
    state,
    error,
    connect,
    disconnect,
    sendAudio,
    sendControl,
  };
}

function isServerEvent(value: unknown): value is ServerEvent {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return (
    type === "ready" ||
    type === "ai.activity" ||
    type === "transcript.partial" ||
    type === "transcript.final" ||
    type === "error" ||
    type === "extraction.symptom" ||
    type === "extraction.medication" ||
    type === "timeline.add" ||
    type === "soap.update" ||
    type === "summary.update"
  );
}
