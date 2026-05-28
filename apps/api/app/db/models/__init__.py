"""ORM model re-exports.

Importing this module ensures every model is registered against the
declarative metadata. Alembic's autogenerate walks `Base.metadata`, so
any model not imported here is invisible to migrations.
"""

from app.db.models.clinical import (
    MedicationRow,
    SoapSectionRow,
    SymptomRow,
    TimelineEventRow,
)
from app.db.models.consultation import (
    Consultation,
    ConsultationStatus,
    TranscriptLine,
)

__all__ = [
    "Consultation",
    "ConsultationStatus",
    "MedicationRow",
    "SoapSectionRow",
    "SymptomRow",
    "TimelineEventRow",
    "TranscriptLine",
]
