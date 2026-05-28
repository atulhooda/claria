/**
 * Typed API client + React Query hooks for the /consultations REST surface.
 *
 * Wire shapes mirror apps/api/app/schemas/consultations.py exactly.
 * Backend serializes snake_case → camelCase via the project's BaseSchema
 * aliasGenerator, so the TypeScript types here use camelCase.
 *
 * Note: the WebSocket consultation stream is unrelated and lives in
 * use-consultation-stream.ts.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

export type ConsultationStatus = "live" | "completed" | "reviewed";
export type Speaker = "doctor" | "patient";
export type Severity = "mild" | "moderate" | "severe";
export type MedicationStatus = "current" | "prescribed" | "discontinued";
export type SoapLabel = "S" | "O" | "A" | "P";
export type TimelineKind = "topic" | "vital" | "medication" | "follow-up";

export interface PatientPayload {
  name: string | null;
  age: number | null;
  pronouns: string | null;
  mrn: string | null;
  chiefComplaint: string | null;
  visitDate: string | null; // ISO date "YYYY-MM-DD"
}

export interface ConsultationSummary {
  id: string;
  status: ConsultationStatus;
  patient: PatientPayload;
  startedAt: string; // ISO datetime
  endedAt: string | null;
  durationSec: number | null;
  summary: string;
  language: string | null;
}

export interface TranscriptLinePayload {
  id: string;
  lineExternalId: string;
  timestampSec: number;
  speaker: Speaker;
  text: string;
  confidence: number | null;
}

export interface SoapSectionPayload {
  label: SoapLabel;
  body: string;
  confidence: number;
  updatedAt: string;
}

export interface SymptomPayload {
  id: string;
  externalId: string;
  label: string;
  severity: Severity;
  duration: string | null;
  confidence: number;
}

export interface MedicationPayload {
  id: string;
  externalId: string;
  name: string;
  dose: string | null;
  frequency: string | null;
  status: MedicationStatus;
  confidence: number;
}

export interface TimelineEventPayload {
  id: string;
  externalId: string;
  timestampSec: number;
  label: string;
  kind: TimelineKind;
}

export interface ConsultationDetail extends ConsultationSummary {
  transcript: TranscriptLinePayload[];
  soap: SoapSectionPayload[];
  symptoms: SymptomPayload[];
  medications: MedicationPayload[];
  timeline: TimelineEventPayload[];
}

export interface CreateConsultationRequest {
  patientName?: string;
  patientAge?: number;
  patientPronouns?: string;
  patientMrn?: string;
  patientChiefComplaint?: string;
}

/* ─────────────── raw API fns ─────────────── */

const ROOT = "/consultations";

export const consultationsApi = {
  list: () => api.get<ConsultationSummary[]>(ROOT),
  get: (id: string) => api.get<ConsultationDetail>(`${ROOT}/${id}`),
  create: (body: CreateConsultationRequest = {}) =>
    api.post<ConsultationSummary>(ROOT, body as Record<string, unknown>),
  markReviewed: (id: string) =>
    api.patch<ConsultationSummary>(`${ROOT}/${id}/review`, { reviewed: true }),
};

/* ─────────────── React Query hooks ─────────────── */

export const consultationsKeys = {
  all: ["consultations"] as const,
  list: () => [...consultationsKeys.all, "list"] as const,
  detail: (id: string) => [...consultationsKeys.all, "detail", id] as const,
};

export function useConsultationsList() {
  return useQuery({
    queryKey: consultationsKeys.list(),
    queryFn: consultationsApi.list,
  });
}

export function useConsultationDetail(
  id: string,
  options: { refetchInterval?: number | false } = {},
) {
  return useQuery({
    queryKey: consultationsKeys.detail(id),
    queryFn: () => consultationsApi.get(id),
    refetchInterval: options.refetchInterval ?? false,
  });
}

export function useCreateConsultation() {
  const qc = useQueryClient();
  return useMutation<ConsultationSummary, Error, CreateConsultationRequest | void>({
    mutationFn: (body) =>
      consultationsApi.create(body || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationsKeys.list() });
    },
  });
}

export function useMarkReviewed(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => consultationsApi.markReviewed(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationsKeys.detail(id) });
      qc.invalidateQueries({ queryKey: consultationsKeys.list() });
    },
  });
}
