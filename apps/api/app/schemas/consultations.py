"""Pydantic schemas for the /consultations HTTP surface.

Wire format the web client consumes via the typed API client. Field
names match the TypeScript types in apps/web/src/lib/api/consultations.ts.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.schemas.common import BaseSchema

ConsultationStatusLiteral = Literal["live", "completed", "reviewed"]


class ConsultationPatientPayload(BaseSchema):
    name: str | None = None
    age: int | None = None
    pronouns: str | None = None
    mrn: str | None = None
    chief_complaint: str | None = None
    visit_date: date | None = None


class ConsultationSummary(BaseSchema):
    """Shape returned by the list endpoint — no transcript / SOAP / etc."""

    id: uuid.UUID
    status: ConsultationStatusLiteral
    patient: ConsultationPatientPayload
    started_at: datetime
    ended_at: datetime | None
    duration_sec: int | None
    summary: str
    language: str | None


class TranscriptLinePayload(BaseSchema):
    id: uuid.UUID
    line_external_id: str
    timestamp_sec: float
    speaker: Literal["doctor", "patient"]
    text: str
    confidence: float | None


class SoapSectionPayload(BaseSchema):
    label: Literal["S", "O", "A", "P"]
    body: str
    confidence: float
    updated_at: datetime


class SymptomPayload(BaseSchema):
    id: uuid.UUID
    external_id: str
    label: str
    severity: Literal["mild", "moderate", "severe"]
    duration: str | None
    confidence: float


class MedicationPayload(BaseSchema):
    id: uuid.UUID
    external_id: str
    name: str
    dose: str | None
    frequency: str | None
    status: Literal["current", "prescribed", "discontinued"]
    confidence: float


class TimelineEventPayload(BaseSchema):
    id: uuid.UUID
    external_id: str
    timestamp_sec: float
    label: str
    kind: Literal["topic", "vital", "medication", "follow-up"]


class ConsultationDetail(ConsultationSummary):
    """Full review payload."""

    transcript: list[TranscriptLinePayload] = Field(default_factory=list)
    soap: list[SoapSectionPayload] = Field(default_factory=list)
    symptoms: list[SymptomPayload] = Field(default_factory=list)
    medications: list[MedicationPayload] = Field(default_factory=list)
    timeline: list[TimelineEventPayload] = Field(default_factory=list)


class CreateConsultationRequest(BaseSchema):
    """Optional patient meta the client can include on POST.

    All fields optional — a "Start live consultation" CTA with no form
    can hit POST with an empty body and the row gets default placeholders.
    """

    patient_name: str | None = None
    patient_age: int | None = None
    patient_pronouns: str | None = None
    patient_mrn: str | None = None
    patient_chief_complaint: str | None = None


class MarkReviewedRequest(BaseSchema):
    reviewed: bool = True
