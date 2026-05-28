"""Consultation core ORM models.

Top-level `Consultation` plus its append-only child `TranscriptLine`.
Clinical children (SOAP, symptoms, medications, timeline) live in
`clinical.py` so this module stays focused on the session itself.

Conventions:
  - All primary keys are UUIDs generated server-side at insert time. We
    never trust client-supplied ids.
  - Timestamps are timezone-aware (UTC) — SQLAlchemy maps Python's
    `datetime` to TIMESTAMP WITH TIME ZONE on Postgres.
  - All FK columns are indexed (Postgres doesn't auto-index FKs).
  - `external_id` columns hold the orchestrator-issued ids ("sx-...",
    "f-...") so realtime events can be upserted idempotently — useful
    if the WS reconnects mid-stream.
"""

from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.clinical import (
        MedicationRow,
        SoapSectionRow,
        SymptomRow,
        TimelineEventRow,
    )


class ConsultationStatus(enum.StrEnum):
    """Lifecycle states for a consultation row.

    live → WS is (or was) connected and recording.
    completed → user pressed Stop; AI passes finalized; awaiting review.
    reviewed → doctor reviewed and approved the AI outputs.
    """

    LIVE = "live"
    COMPLETED = "completed"
    REVIEWED = "reviewed"


class Consultation(Base):
    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)

    status: Mapped[ConsultationStatus] = mapped_column(
        Enum(ConsultationStatus, name="consultation_status"),
        nullable=False,
        default=ConsultationStatus.LIVE,
    )

    # Patient meta — all optional. Live consults are created with placeholders;
    # a future phase lets the doctor edit these inline during/after the consult.
    patient_name: Mapped[str | None] = mapped_column(String(160))
    patient_age: Mapped[int | None] = mapped_column(Integer)
    patient_pronouns: Mapped[str | None] = mapped_column(String(32))
    patient_mrn: Mapped[str | None] = mapped_column(String(64))
    patient_chief_complaint: Mapped[str | None] = mapped_column(Text)
    visit_date: Mapped[date | None] = mapped_column(Date)

    # Audit columns — which providers ran this consult. Important when models
    # change months later and someone is reviewing AI outputs.
    language: Mapped[str | None] = mapped_column(String(16))
    deepgram_model: Mapped[str | None] = mapped_column(String(64))
    openai_model_capable: Mapped[str | None] = mapped_column(String(64))

    # Lifecycle timestamps.
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_sec: Mapped[int | None] = mapped_column(Integer)

    # Latest AI-generated headline. Updated by the summary loop.
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Children — populated eagerly via selectinload on the detail endpoint;
    # list endpoint does NOT touch these.
    transcript_lines: Mapped[list[TranscriptLine]] = relationship(
        back_populates="consultation",
        cascade="all, delete-orphan",
        order_by="TranscriptLine.timestamp_sec, TranscriptLine.created_at",
    )
    soap_sections: Mapped[list[SoapSectionRow]] = relationship(
        back_populates="consultation",
        cascade="all, delete-orphan",
    )
    symptoms: Mapped[list[SymptomRow]] = relationship(
        back_populates="consultation",
        cascade="all, delete-orphan",
        order_by="SymptomRow.first_seen_at",
    )
    medications: Mapped[list[MedicationRow]] = relationship(
        back_populates="consultation",
        cascade="all, delete-orphan",
        order_by="MedicationRow.first_seen_at",
    )
    timeline_events: Mapped[list[TimelineEventRow]] = relationship(
        back_populates="consultation",
        cascade="all, delete-orphan",
        order_by="TimelineEventRow.timestamp_sec",
    )


class TranscriptLine(Base):
    """One finalized transcript line. Partials are not persisted."""

    __tablename__ = "transcript_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Orchestrator-issued line id, unique within a consultation. Lets us
    # safely re-receive an event without inserting twice.
    line_external_id: Mapped[str] = mapped_column(String(64), nullable=False)

    timestamp_sec: Mapped[float] = mapped_column(Float, nullable=False)
    speaker: Mapped[str] = mapped_column(String(16), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    consultation: Mapped[Consultation] = relationship(
        back_populates="transcript_lines"
    )
