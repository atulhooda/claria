"""Clinical-output ORM models.

Children of `Consultation` that hold the AI-generated artifacts:
SOAP sections, deduped symptoms, deduped medications, timeline
events. Each has an `external_id` that mirrors what the orchestrator
emits so realtime events upsert idempotently.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.consultation import Consultation


class SoapSectionRow(Base):
    """One section of the evolving SOAP note.

    Updated in place — we keep the latest body / confidence per
    (consultation, label). No version history for Phase 4; if we need
    audit later, add a sibling `soap_section_versions` table.
    """

    __tablename__ = "soap_sections"
    __table_args__ = (
        UniqueConstraint(
            "consultation_id", "label", name="uq_soap_sections_consultation_id_label"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # S | O | A | P. Stored as a short string rather than a PG enum so
    # adding a section type in the future doesn't require a migration.
    label: Mapped[str] = mapped_column(String(2), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    consultation: Mapped[Consultation] = relationship(
        back_populates="soap_sections"
    )


class SymptomRow(Base):
    __tablename__ = "symptoms"
    __table_args__ = (
        UniqueConstraint(
            "consultation_id",
            "external_id",
            name="uq_symptoms_consultation_id_external_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)

    label: Mapped[str] = mapped_column(String(160), nullable=False)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    duration: Mapped[str | None] = mapped_column(String(64))
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    consultation: Mapped[Consultation] = relationship(back_populates="symptoms")


class MedicationRow(Base):
    __tablename__ = "medications"
    __table_args__ = (
        UniqueConstraint(
            "consultation_id",
            "external_id",
            name="uq_medications_consultation_id_external_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    dose: Mapped[str | None] = mapped_column(String(64))
    frequency: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)

    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    consultation: Mapped[Consultation] = relationship(back_populates="medications")


class TimelineEventRow(Base):
    """Append-only — we never update or delete timeline events."""

    __tablename__ = "timeline_events"
    __table_args__ = (
        UniqueConstraint(
            "consultation_id",
            "external_id",
            name="uq_timeline_events_consultation_id_external_id",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    consultation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("consultations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str] = mapped_column(String(64), nullable=False)

    timestamp_sec: Mapped[float] = mapped_column(Float, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    consultation: Mapped[Consultation] = relationship(
        back_populates="timeline_events"
    )
