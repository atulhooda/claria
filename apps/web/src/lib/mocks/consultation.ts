/**
 * Mock consultation fixture used by the workspace page in lieu of a real
 * backend stream. Shapes here model the eventual API contracts so the
 * UI can be wired up later without restructuring components.
 */

export type Speaker = "doctor" | "patient";
export type SoapLabel = "S" | "O" | "A" | "P";

export interface TranscriptLine {
  id: string;
  timestampSec: number;
  speaker: Speaker;
  text: string;
}

export interface SoapSection {
  label: SoapLabel;
  title: string;
  body: string;
  /** 0–1 — used to render the confidence meter. */
  confidence: number;
}

export interface Symptom {
  id: string;
  label: string;
  severity: "mild" | "moderate" | "severe";
  confidence: number;
}

export interface Medication {
  id: string;
  name: string;
  dose?: string;
  frequency?: string;
  status: "current" | "prescribed" | "discontinued";
}

export interface VitalReading {
  id: string;
  label: string;
  value: string;
  unit?: string;
  status?: "normal" | "elevated" | "low";
}

export interface TimelineMarker {
  id: string;
  timestampSec: number;
  label: string;
  kind: "topic" | "vital" | "medication" | "follow-up";
}

export interface PatientMeta {
  name: string;
  age: number;
  pronouns: string;
  mrn: string;
  chiefComplaint: string;
  /** ISO date string. */
  visitDate: string;
}

export interface MockConsultation {
  id: string;
  status: "in-progress" | "completed" | "draft";
  patient: PatientMeta;
  startedAtSec: number;
  /** Full transcript — `useMockStream` reveals these progressively. */
  transcript: TranscriptLine[];
  soap: SoapSection[];
  symptoms: Symptom[];
  medications: Medication[];
  vitals: VitalReading[];
  timeline: TimelineMarker[];
}

export const SAMPLE_CONSULTATION_ID = "sample-001";

export const sampleConsultation: MockConsultation = {
  id: SAMPLE_CONSULTATION_ID,
  status: "in-progress",
  startedAtSec: 0,
  patient: {
    name: "Eleanor Whitford",
    age: 58,
    pronouns: "she/her",
    mrn: "MRN-184302",
    chiefComplaint: "Exertional chest tightness, 3-day history",
    visitDate: "2026-05-28",
  },
  transcript: [
    {
      id: "t1",
      timestampSec: 12,
      speaker: "doctor",
      text: "Good morning, Eleanor. Tell me what brought you in today.",
    },
    {
      id: "t2",
      timestampSec: 22,
      speaker: "patient",
      text:
        "I've had this tightness across my chest for about three days. It's worse when I walk up the stairs at home.",
    },
    {
      id: "t3",
      timestampSec: 40,
      speaker: "doctor",
      text:
        "I'm sorry to hear that. Any shortness of breath, pain into your arm, jaw, or back?",
    },
    {
      id: "t4",
      timestampSec: 58,
      speaker: "patient",
      text:
        "A little breathless, yes. No pain anywhere else. I get a bit clammy if I push myself.",
    },
    {
      id: "t5",
      timestampSec: 78,
      speaker: "doctor",
      text:
        "Are you still taking the metoprolol we started for your blood pressure?",
    },
    {
      id: "t6",
      timestampSec: 92,
      speaker: "patient",
      text:
        "Yes, every morning. Twenty-five milligrams. And the rosuvastatin in the evening.",
    },
    {
      id: "t7",
      timestampSec: 112,
      speaker: "doctor",
      text:
        "Good. Any new medications or anything over the counter — even supplements?",
    },
    {
      id: "t8",
      timestampSec: 126,
      speaker: "patient",
      text:
        "Just an ibuprofen here and there for my knee. Nothing daily.",
    },
    {
      id: "t9",
      timestampSec: 148,
      speaker: "doctor",
      text:
        "Okay. I'd like to run an ECG and check some bloods today, including a troponin, just to be cautious.",
    },
    {
      id: "t10",
      timestampSec: 168,
      speaker: "patient",
      text: "Whatever you think is right. I just want to know I'm okay.",
    },
  ],
  soap: [
    {
      label: "S",
      title: "Subjective",
      body:
        "58-year-old female with 3-day history of exertional chest tightness, accompanied by mild dyspnea and diaphoresis. No radiation to arm, jaw, or back. Symptoms reproducible on stair climbing. Adherent to metoprolol 25 mg daily and rosuvastatin nightly. Occasional ibuprofen for knee pain.",
      confidence: 0.94,
    },
    {
      label: "O",
      title: "Objective",
      body:
        "BP 138/86 mmHg, HR 92 bpm, SpO₂ 97% on room air, Temp 36.8 °C. Lungs clear to auscultation. Heart sounds regular, no murmurs or gallops. Peripheral pulses intact. ECG pending.",
      confidence: 0.88,
    },
    {
      label: "A",
      title: "Assessment",
      body:
        "Working differential includes stable angina (most likely) versus musculoskeletal etiology. Risk factors: hypertension, hyperlipidemia, age, female sex.",
      confidence: 0.76,
    },
    {
      label: "P",
      title: "Plan",
      body:
        "1) 12-lead ECG today. 2) Troponin × 0/3 h. 3) CBC, BMP, lipid panel. 4) If labs reassuring, outpatient stress test within one week. 5) Continue current medications. 6) Return immediately for worsening pain, dyspnea, or new symptoms.",
      confidence: 0.81,
    },
  ],
  symptoms: [
    { id: "s1", label: "Exertional chest tightness", severity: "moderate", confidence: 0.96 },
    { id: "s2", label: "Mild dyspnea on exertion", severity: "mild", confidence: 0.88 },
    { id: "s3", label: "Diaphoresis (exertional)", severity: "mild", confidence: 0.74 },
    { id: "s4", label: "Knee pain (chronic)", severity: "mild", confidence: 0.62 },
  ],
  medications: [
    { id: "m1", name: "Metoprolol", dose: "25 mg", frequency: "PO daily AM", status: "current" },
    { id: "m2", name: "Rosuvastatin", dose: "10 mg", frequency: "PO nightly", status: "current" },
    { id: "m3", name: "Ibuprofen", dose: "200 mg", frequency: "PRN knee pain", status: "current" },
  ],
  vitals: [
    { id: "v1", label: "BP", value: "138/86", unit: "mmHg", status: "elevated" },
    { id: "v2", label: "HR", value: "92", unit: "bpm", status: "normal" },
    { id: "v3", label: "SpO₂", value: "97", unit: "%", status: "normal" },
    { id: "v4", label: "Temp", value: "36.8", unit: "°C", status: "normal" },
  ],
  timeline: [
    { id: "tl1", timestampSec: 12, label: "Greeting", kind: "topic" },
    { id: "tl2", timestampSec: 22, label: "Chief complaint", kind: "topic" },
    { id: "tl3", timestampSec: 78, label: "Medication review", kind: "medication" },
    { id: "tl4", timestampSec: 138, label: "Vitals captured", kind: "vital" },
    { id: "tl5", timestampSec: 148, label: "Workup plan", kind: "follow-up" },
  ],
};

export function getMockConsultation(id: string): MockConsultation | null {
  if (id === SAMPLE_CONSULTATION_ID) return sampleConsultation;
  return null;
}

/** Marker that this id is a live (real-pipeline) consultation, not a mock. */
export const LIVE_ID_PREFIX = "live-";

export function isLiveConsultationId(id: string): boolean {
  return id.startsWith(LIVE_ID_PREFIX);
}

/**
 * Synthesize an empty consultation shell for a live session. Patient
 * meta is placeholder; the doctor will fill these in via the workspace
 * header in a later phase. Extractions/vitals/timeline/SOAP all start
 * empty and fill in as the real pipeline runs.
 */
export function makeLiveConsultation(id: string): MockConsultation {
  return {
    id,
    status: "in-progress",
    startedAtSec: 0,
    patient: {
      name: "New consultation",
      age: 0,
      pronouns: "—",
      mrn: id,
      chiefComplaint:
        "Reason for visit will appear as the AI extracts it from the conversation.",
      visitDate: new Date().toISOString().slice(0, 10),
    },
    transcript: [],
    soap: [
      { label: "S", title: "Subjective", body: "", confidence: 0 },
      { label: "O", title: "Objective", body: "", confidence: 0 },
      { label: "A", title: "Assessment", body: "", confidence: 0 },
      { label: "P", title: "Plan", body: "", confidence: 0 },
    ],
    symptoms: [],
    medications: [],
    vitals: [],
    timeline: [],
  };
}
