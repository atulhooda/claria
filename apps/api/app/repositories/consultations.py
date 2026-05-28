"""Repository for consultation reads and lifecycle writes.

The PersistenceWriter handles the streaming inserts (transcript lines,
SOAP upserts, entity upserts) on its own. This repository owns the
lifecycle-level operations: create a new consultation row, list a
user's consultations, load a full detail payload for the review page,
finalize a consultation when its stream ends.

Service code uses these — routes never build queries directly.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Consultation, ConsultationStatus


class ConsultationRepository:
    """All persistence for the consultation aggregate root."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ─────────────── lifecycle ───────────────

    async def create(
        self,
        *,
        user_id: str,
        patient_name: str | None = None,
        language: str | None = None,
        deepgram_model: str | None = None,
        openai_model_capable: str | None = None,
    ) -> Consultation:
        """Insert a new consultation row in `live` state."""
        consultation = Consultation(
            user_id=user_id,
            status=ConsultationStatus.LIVE,
            patient_name=patient_name,
            language=language,
            deepgram_model=deepgram_model,
            openai_model_capable=openai_model_capable,
            visit_date=datetime.now(UTC).date(),
        )
        self.session.add(consultation)
        await self.session.flush()
        return consultation

    async def finalize(self, consultation_id: uuid.UUID) -> None:
        """Mark a consultation completed and record its duration.

        Idempotent: calling on an already-completed row is a no-op
        because the WHERE clause filters on `status == LIVE`.
        """
        existing = await self.session.get(Consultation, consultation_id)
        if existing is None or existing.status != ConsultationStatus.LIVE:
            return
        now = datetime.now(UTC)
        existing.status = ConsultationStatus.COMPLETED
        existing.ended_at = now
        existing.duration_sec = int((now - existing.started_at).total_seconds())
        existing.updated_at = now

    async def mark_reviewed(self, consultation_id: uuid.UUID) -> None:
        existing = await self.session.get(Consultation, consultation_id)
        if existing is None:
            return
        existing.status = ConsultationStatus.REVIEWED
        existing.updated_at = datetime.now(UTC)

    async def update_summary(
        self, *, consultation_id: uuid.UUID, summary: str
    ) -> None:
        """Called by the persistence writer when a `summary.update` event lands."""
        existing = await self.session.get(Consultation, consultation_id)
        if existing is None:
            return
        existing.summary = summary
        existing.updated_at = datetime.now(UTC)

    # ─────────────── reads ───────────────

    async def get_for_user(
        self, *, consultation_id: uuid.UUID, user_id: str
    ) -> Consultation | None:
        """Bare metadata lookup. No relations loaded."""
        result = await self.session.execute(
            select(Consultation).where(
                Consultation.id == consultation_id,
                Consultation.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_with_detail(
        self, *, consultation_id: uuid.UUID, user_id: str
    ) -> Consultation | None:
        """Full review payload — eagerly loads every child collection."""
        result = await self.session.execute(
            select(Consultation)
            .where(
                Consultation.id == consultation_id,
                Consultation.user_id == user_id,
            )
            .options(
                selectinload(Consultation.transcript_lines),
                selectinload(Consultation.soap_sections),
                selectinload(Consultation.symptoms),
                selectinload(Consultation.medications),
                selectinload(Consultation.timeline_events),
            )
        )
        return result.scalar_one_or_none()

    async def list_for_user(
        self, *, user_id: str, limit: int = 50
    ) -> list[Consultation]:
        """List endpoint backing query — header-only columns, no joins."""
        result = await self.session.execute(
            select(Consultation)
            .where(Consultation.user_id == user_id)
            .order_by(desc(Consultation.started_at))
            .limit(limit)
        )
        return list(result.scalars().all())
