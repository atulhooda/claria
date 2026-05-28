"""HTTP CRUD for consultations.

Companion to `stream.py` (which owns the WebSocket). Routes:

  POST   /consultations              create a new live consultation row
  GET    /consultations              list the caller's consultations
  GET    /consultations/{id}         full review detail
  PATCH  /consultations/{id}/review  mark reviewed (status flip)

All routes are user-scoped via `CurrentUser` — no row reaches the
caller unless `user_id` matches.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.exceptions import NotFoundError
from app.db.models import Consultation
from app.repositories.consultations import ConsultationRepository
from app.schemas.consultations import (
    ConsultationDetail,
    ConsultationPatientPayload,
    ConsultationSummary,
    CreateConsultationRequest,
    MarkReviewedRequest,
    MedicationPayload,
    SoapSectionPayload,
    SymptomPayload,
    TimelineEventPayload,
    TranscriptLinePayload,
)

router = APIRouter(prefix="/consultations", tags=["consultations"])


# ─────────────────────── POST /consultations ───────────────────────


@router.post(
    "",
    response_model=ConsultationSummary,
    status_code=status.HTTP_201_CREATED,
)
async def create_consultation(
    payload: CreateConsultationRequest,
    user: CurrentUser,
    db: DbSession,
) -> ConsultationSummary:
    """Create a new live consultation. Returns the id the WS will use."""
    settings = get_settings()
    repo = ConsultationRepository(db)
    consultation = await repo.create(
        user_id=user.id,
        patient_name=payload.patient_name,
        language=settings.deepgram_language,
        deepgram_model=settings.deepgram_model,
        openai_model_capable=settings.openai_model_capable,
    )
    # Apply any other patient fields the caller passed.
    if payload.patient_age is not None:
        consultation.patient_age = payload.patient_age
    if payload.patient_pronouns is not None:
        consultation.patient_pronouns = payload.patient_pronouns
    if payload.patient_mrn is not None:
        consultation.patient_mrn = payload.patient_mrn
    if payload.patient_chief_complaint is not None:
        consultation.patient_chief_complaint = payload.patient_chief_complaint

    return _to_summary(consultation)


# ─────────────────────── GET /consultations ───────────────────────


@router.get("", response_model=list[ConsultationSummary])
async def list_consultations(
    user: CurrentUser,
    db: DbSession,
) -> list[ConsultationSummary]:
    repo = ConsultationRepository(db)
    rows = await repo.list_for_user(user_id=user.id)
    return [_to_summary(r) for r in rows]


# ─────────────────────── GET /consultations/{id} ───────────────────────


@router.get("/{consultation_id}", response_model=ConsultationDetail)
async def get_consultation(
    consultation_id: uuid.UUID,
    user: CurrentUser,
    db: DbSession,
) -> ConsultationDetail:
    repo = ConsultationRepository(db)
    consultation = await repo.get_with_detail(
        consultation_id=consultation_id, user_id=user.id
    )
    if consultation is None:
        raise NotFoundError("consultation not found", code="CONSULTATION_NOT_FOUND")
    return _to_detail(consultation)


# ─────────────────── PATCH /consultations/{id}/review ───────────────────


@router.patch("/{consultation_id}/review", response_model=ConsultationSummary)
async def mark_reviewed(
    consultation_id: uuid.UUID,
    payload: MarkReviewedRequest,
    user: CurrentUser,
    db: DbSession,
) -> ConsultationSummary:
    repo = ConsultationRepository(db)
    consultation = await repo.get_for_user(
        consultation_id=consultation_id, user_id=user.id
    )
    if consultation is None:
        raise NotFoundError("consultation not found", code="CONSULTATION_NOT_FOUND")
    if payload.reviewed:
        await repo.mark_reviewed(consultation_id)
        await db.flush()
        await db.refresh(consultation)
    return _to_summary(consultation)


# ──────────────────────────── adapters ────────────────────────────


def _patient_from_row(row: Consultation) -> ConsultationPatientPayload:
    return ConsultationPatientPayload(
        name=row.patient_name,
        age=row.patient_age,
        pronouns=row.patient_pronouns,
        mrn=row.patient_mrn,
        chief_complaint=row.patient_chief_complaint,
        visit_date=row.visit_date,
    )


def _to_summary(row: Consultation) -> ConsultationSummary:
    return ConsultationSummary(
        id=row.id,
        status=row.status.value,
        patient=_patient_from_row(row),
        started_at=row.started_at,
        ended_at=row.ended_at,
        duration_sec=row.duration_sec,
        summary=row.summary,
        language=row.language,
    )


def _to_detail(row: Consultation) -> ConsultationDetail:
    return ConsultationDetail(
        id=row.id,
        status=row.status.value,
        patient=_patient_from_row(row),
        started_at=row.started_at,
        ended_at=row.ended_at,
        duration_sec=row.duration_sec,
        summary=row.summary,
        language=row.language,
        transcript=[
            TranscriptLinePayload(
                id=t.id,
                line_external_id=t.line_external_id,
                timestamp_sec=t.timestamp_sec,
                speaker=t.speaker,  # type: ignore[arg-type]
                text=t.text,
                confidence=t.confidence,
            )
            for t in row.transcript_lines
        ],
        soap=[
            SoapSectionPayload(
                label=s.label,  # type: ignore[arg-type]
                body=s.body,
                confidence=s.confidence,
                updated_at=s.updated_at,
            )
            for s in row.soap_sections
        ],
        symptoms=[
            SymptomPayload(
                id=s.id,
                external_id=s.external_id,
                label=s.label,
                severity=s.severity,  # type: ignore[arg-type]
                duration=s.duration,
                confidence=s.confidence,
            )
            for s in row.symptoms
        ],
        medications=[
            MedicationPayload(
                id=m.id,
                external_id=m.external_id,
                name=m.name,
                dose=m.dose,
                frequency=m.frequency,
                status=m.status,  # type: ignore[arg-type]
                confidence=m.confidence,
            )
            for m in row.medications
        ],
        timeline=[
            TimelineEventPayload(
                id=t.id,
                external_id=t.external_id,
                timestamp_sec=t.timestamp_sec,
                label=t.label,
                kind=t.kind,  # type: ignore[arg-type]
            )
            for t in row.timeline_events
        ],
    )
