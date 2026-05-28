"""Repositories for the consultation's clinical child rows.

Each method is upsert-shaped, keyed on `(consultation_id, external_id)`
or `(consultation_id, label)` — so the PersistenceWriter can replay an
event and get the same end-state. This is what makes WebSocket
reconnects safe: re-receiving an event we already wrote is a no-op.

All methods take an open AsyncSession; transactional boundaries live
above this layer (in the writer).
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    MedicationRow,
    SoapSectionRow,
    SymptomRow,
    TimelineEventRow,
    TranscriptLine,
)


class TranscriptRepository:
    """Append-only — transcript lines are immutable once written."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def insert_if_new(
        self,
        *,
        consultation_id: uuid.UUID,
        line_external_id: str,
        timestamp_sec: float,
        speaker: str,
        text: str,
        confidence: float | None,
    ) -> None:
        # Cheap existence check via the partial index on
        # (consultation_id, line_external_id). For Phase 4 we don't
        # enforce a DB unique constraint here — letting the writer's
        # in-memory dedupe handle the common case — but the check
        # protects against rare double-deliveries on reconnect.
        existing = await self.session.execute(
            select(TranscriptLine.id).where(
                TranscriptLine.consultation_id == consultation_id,
                TranscriptLine.line_external_id == line_external_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            return

        self.session.add(
            TranscriptLine(
                consultation_id=consultation_id,
                line_external_id=line_external_id,
                timestamp_sec=timestamp_sec,
                speaker=speaker,
                text=text,
                confidence=confidence,
            )
        )


class SoapRepository:
    """Upserts one section at a time, in place — no version history."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(
        self,
        *,
        consultation_id: uuid.UUID,
        label: str,
        body: str,
        confidence: float,
    ) -> None:
        result = await self.session.execute(
            select(SoapSectionRow).where(
                SoapSectionRow.consultation_id == consultation_id,
                SoapSectionRow.label == label,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            self.session.add(
                SoapSectionRow(
                    consultation_id=consultation_id,
                    label=label,
                    body=body,
                    confidence=confidence,
                )
            )
        else:
            existing.body = body
            existing.confidence = confidence


class SymptomRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(
        self,
        *,
        consultation_id: uuid.UUID,
        external_id: str,
        label: str,
        severity: str,
        duration: str | None,
        confidence: float,
    ) -> None:
        result = await self.session.execute(
            select(SymptomRow).where(
                SymptomRow.consultation_id == consultation_id,
                SymptomRow.external_id == external_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            self.session.add(
                SymptomRow(
                    consultation_id=consultation_id,
                    external_id=external_id,
                    label=label,
                    severity=severity,
                    duration=duration,
                    confidence=confidence,
                )
            )
        else:
            existing.label = label
            existing.severity = severity
            existing.duration = duration
            existing.confidence = confidence


class MedicationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert(
        self,
        *,
        consultation_id: uuid.UUID,
        external_id: str,
        name: str,
        dose: str | None,
        frequency: str | None,
        status: str,
        confidence: float,
    ) -> None:
        result = await self.session.execute(
            select(MedicationRow).where(
                MedicationRow.consultation_id == consultation_id,
                MedicationRow.external_id == external_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing is None:
            self.session.add(
                MedicationRow(
                    consultation_id=consultation_id,
                    external_id=external_id,
                    name=name,
                    dose=dose,
                    frequency=frequency,
                    status=status,
                    confidence=confidence,
                )
            )
        else:
            existing.name = name
            existing.dose = dose
            existing.frequency = frequency
            existing.status = status
            existing.confidence = confidence


class TimelineEventRepository:
    """Append-only — timeline events are immutable."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def insert_if_new(
        self,
        *,
        consultation_id: uuid.UUID,
        external_id: str,
        timestamp_sec: float,
        label: str,
        kind: str,
    ) -> None:
        existing = await self.session.execute(
            select(TimelineEventRow.id).where(
                TimelineEventRow.consultation_id == consultation_id,
                TimelineEventRow.external_id == external_id,
            )
        )
        if existing.scalar_one_or_none() is not None:
            return
        self.session.add(
            TimelineEventRow(
                consultation_id=consultation_id,
                external_id=external_id,
                timestamp_sec=timestamp_sec,
                label=label,
                kind=kind,
            )
        )
