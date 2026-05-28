"""Typed clinical AI outputs.

Two roles:
  1. OpenAI Structured Outputs uses these as `response_format`, which
     constrains the model's generation to the schema at decode time.
  2. The WebSocket layer serializes them to the wire format the web
     client folds into workspace state.

Field names match the TypeScript interfaces in apps/web/src/lib/mocks/
consultation.ts so the same UI components can render either.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ────────────────────────── primitives ──────────────────────────

Severity = Literal["mild", "moderate", "severe"]
MedicationStatus = Literal["current", "prescribed", "discontinued"]
SoapLabel = Literal["S", "O", "A", "P"]
TimelineKind = Literal["topic", "vital", "medication", "follow-up"]
Speaker = Literal["doctor", "patient"]


class _Base(BaseModel):
    """Bedrock for AI output models — forbids unknown fields, frozen."""

    model_config = ConfigDict(extra="forbid")


# ────────────────────────── extractions ──────────────────────────


class SymptomExtraction(_Base):
    """One symptom mentioned in the recent transcript window."""

    label: str = Field(description="Canonical symptom name, e.g. 'Exertional chest tightness'.")
    severity: Severity = Field(
        description=(
            "Severity assessment grounded in what the patient said. "
            "Default to 'mild' when not explicitly characterized."
        )
    )
    duration: str | None = Field(
        default=None,
        description="Duration of the symptom if stated by the patient, e.g. '3 days', '2 weeks'.",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Your confidence that this symptom was clearly stated, not inferred. "
            "Below 0.55 will be filtered out before reaching the clinician."
        ),
    )


class MedicationExtraction(_Base):
    """One medication mentioned in the recent transcript window."""

    name: str = Field(description="Generic or brand name as stated, e.g. 'Metoprolol'.")
    dose: str | None = Field(default=None, description="Dose with units, e.g. '25 mg'.")
    frequency: str | None = Field(
        default=None,
        description="Frequency as stated, e.g. 'daily', 'twice daily', 'PRN knee pain'.",
    )
    status: MedicationStatus = Field(
        description=(
            "current = patient is taking it now. prescribed = doctor just prescribed it. "
            "discontinued = stopping or stopped."
        )
    )
    confidence: float = Field(ge=0.0, le=1.0)


class TimelineEventExtraction(_Base):
    """A notable conversational moment worth pinning to the timeline."""

    label: str = Field(description="Short human label, e.g. 'Chief complaint stated'.")
    kind: TimelineKind
    transcript_line_index: int = Field(
        ge=0,
        description="Index in the provided new-lines list this event corresponds to.",
    )
    confidence: float = Field(ge=0.0, le=1.0)


class ExtractionBatch(_Base):
    """One pass of the fast extraction loop over recent transcript lines."""

    symptoms: list[SymptomExtraction] = Field(
        default_factory=list,
        description=(
            "Symptoms newly mentioned in the provided lines. "
            "Do not repeat symptoms already in the prior-state list."
        ),
    )
    medications: list[MedicationExtraction] = Field(
        default_factory=list,
        description=(
            "Medications newly mentioned in the provided lines. "
            "Do not repeat medications already in the prior-state list."
        ),
    )
    timeline_events: list[TimelineEventExtraction] = Field(
        default_factory=list,
        description="Notable conversational moments worth marking on the timeline.",
    )


# ────────────────────────── SOAP draft ──────────────────────────


class SoapSectionDraft(_Base):
    """One section of the evolving SOAP note."""

    label: SoapLabel
    body: str = Field(
        description=(
            "Section body as a clinician would write it. Concise, declarative, "
            "third-person, no headers inside the body. Cite ONLY what's in the "
            "transcript — never invent vitals, labs, or history not stated."
        )
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        description=(
            "Self-assessed coverage: how complete this section feels given the "
            "transcript so far. Rises as the conversation gathers more relevant content."
        ),
    )


class SoapDraft(_Base):
    """Full SOAP draft returned by a single refine pass."""

    sections: list[SoapSectionDraft] = Field(
        min_length=4,
        max_length=4,
        description=(
            "Exactly four sections in order: S, O, A, P. Even if a section is "
            "empty, include it with body='' and confidence=0."
        ),
    )


# ────────────────────────── summary ──────────────────────────


class ClinicalSummary(_Base):
    """One-line clinical headline used in the workspace header."""

    headline: str = Field(
        max_length=240,
        description=(
            "One sentence summary of the consultation so far, focused on the "
            "chief complaint and any active assessment. No fluff."
        ),
    )
