"""In-memory state for one live consultation.

Owned by the WebSocket handler for the lifetime of a connection. The
orchestrator and pipelines mutate this through narrow methods so the
mutation surface stays auditable.

What lives here:
  - All finalized transcript lines (append-only)
  - High watermarks per pipeline (so each loop knows what's new since
    its last run)
  - Current SOAP draft
  - Deduplicated symptoms + medications keyed by normalized label
  - Running summary headline
  - Most recent timeline events

What does NOT live here:
  - Partial (interim) transcript lines — those are forwarded to the
    client as they arrive but don't participate in AI passes.
  - Anything Postgres-persisted — Phase 2 keeps everything in process
    memory; a future phase will persist deltas to the DB.
"""

from __future__ import annotations

import asyncio
import re
import time
import uuid
from collections.abc import Iterable
from dataclasses import dataclass, field

from app.schemas.clinical import (
    ClinicalSummary,
    MedicationExtraction,
    SoapSectionDraft,
    Speaker,
    SymptomExtraction,
    TimelineEventExtraction,
    TimelineKind,
)

_EMPTY_SOAP: list[SoapSectionDraft] = [
    SoapSectionDraft(label="S", body="", confidence=0.0),
    SoapSectionDraft(label="O", body="", confidence=0.0),
    SoapSectionDraft(label="A", body="", confidence=0.0),
    SoapSectionDraft(label="P", body="", confidence=0.0),
]


@dataclass
class FinalLine:
    """One finalized transcript line. Distinct from the Deepgram type so
    the state layer doesn't depend on the STT provider's shape."""

    id: str
    timestamp_sec: float
    speaker: Speaker
    text: str


@dataclass
class StoredSymptom:
    id: str
    extraction: SymptomExtraction


@dataclass
class StoredMedication:
    id: str
    extraction: MedicationExtraction


@dataclass
class StoredTimelineEvent:
    id: str
    timestamp_sec: float
    label: str
    kind: TimelineKind


def _normalize(s: str) -> str:
    """Loose normalization for entity dedupe keys."""
    return re.sub(r"\s+", " ", s.strip().lower())


@dataclass
class ConsultationState:
    """All AI-related state for one live consultation."""

    consultation_id: str

    # Transcript
    finals: list[FinalLine] = field(default_factory=list)

    # Pipeline high watermarks (number of finals processed at last run).
    extraction_watermark: int = 0
    soap_watermark: int = 0

    # Last-run timestamps (monotonic) — for interval gating.
    last_extraction_at: float = 0.0
    last_soap_at: float = 0.0
    last_summary_at: float = 0.0

    # Current AI outputs.
    soap: list[SoapSectionDraft] = field(
        default_factory=lambda: list(_EMPTY_SOAP)
    )
    summary: str = ""

    symptoms_by_key: dict[str, StoredSymptom] = field(default_factory=dict)
    medications_by_key: dict[str, StoredMedication] = field(default_factory=dict)
    timeline_events: list[StoredTimelineEvent] = field(default_factory=list)

    # Concurrency guard — only one extraction / soap call in flight at a time.
    _extraction_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    _soap_lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    _summary_lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    # ─────────────── transcript ───────────────

    def add_final(self, *, line_id: str, t: float, speaker: Speaker, text: str) -> None:
        self.finals.append(
            FinalLine(id=line_id, timestamp_sec=t, speaker=speaker, text=text)
        )

    def new_finals_since(self, watermark: int) -> list[FinalLine]:
        return self.finals[watermark:]

    # ─────────────── extraction pipeline integration ───────────────

    def acquire_extraction_lock(self) -> asyncio.Lock:
        return self._extraction_lock

    def mark_extraction_run(self) -> None:
        self.extraction_watermark = len(self.finals)
        self.last_extraction_at = time.monotonic()

    def store_extracted_symptoms(
        self, batch: Iterable[SymptomExtraction]
    ) -> list[StoredSymptom]:
        """Dedupe by normalized label. New severity/confidence wins. Returns added."""
        added: list[StoredSymptom] = []
        for sym in batch:
            if sym.confidence < 0.55:
                continue
            key = _normalize(sym.label)
            if not key:
                continue
            existing = self.symptoms_by_key.get(key)
            if existing is None:
                stored = StoredSymptom(id=f"sx-{uuid.uuid4().hex[:10]}", extraction=sym)
                self.symptoms_by_key[key] = stored
                added.append(stored)
            else:
                # Update severity / confidence if the new one is more confident.
                if sym.confidence > existing.extraction.confidence:
                    existing.extraction = sym
                    added.append(existing)
        return added

    def store_extracted_medications(
        self, batch: Iterable[MedicationExtraction]
    ) -> list[StoredMedication]:
        added: list[StoredMedication] = []
        for med in batch:
            if med.confidence < 0.55:
                continue
            key = _normalize(med.name)
            if not key:
                continue
            existing = self.medications_by_key.get(key)
            if existing is None:
                stored = StoredMedication(id=f"med-{uuid.uuid4().hex[:10]}", extraction=med)
                self.medications_by_key[key] = stored
                added.append(stored)
            else:
                # Update dose/freq if the new one is more confident or fills gaps.
                if (
                    med.confidence > existing.extraction.confidence
                    or (med.dose and not existing.extraction.dose)
                    or (med.frequency and not existing.extraction.frequency)
                ):
                    existing.extraction = med
                    added.append(existing)
        return added

    def store_timeline_events(
        self,
        events: Iterable[TimelineEventExtraction],
        *,
        new_lines: list[FinalLine],
    ) -> list[StoredTimelineEvent]:
        """Resolve transcript_line_index to a real timestamp and store."""
        added: list[StoredTimelineEvent] = []
        for ev in events:
            if ev.confidence < 0.55:
                continue
            if ev.transcript_line_index < 0 or ev.transcript_line_index >= len(new_lines):
                continue
            line = new_lines[ev.transcript_line_index]
            stored = StoredTimelineEvent(
                id=f"tl-{uuid.uuid4().hex[:10]}",
                timestamp_sec=line.timestamp_sec,
                label=ev.label,
                kind=ev.kind,
            )
            self.timeline_events.append(stored)
            added.append(stored)
        return added

    # ─────────────── soap pipeline integration ───────────────

    def acquire_soap_lock(self) -> asyncio.Lock:
        return self._soap_lock

    def mark_soap_run(self) -> None:
        self.soap_watermark = len(self.finals)
        self.last_soap_at = time.monotonic()

    def update_soap(self, sections: list[SoapSectionDraft]) -> list[SoapSectionDraft]:
        """Replace the SOAP draft. Returns sections whose body OR confidence changed
        (so the wire layer can send only the deltas)."""
        changed: list[SoapSectionDraft] = []
        old_by_label = {s.label: s for s in self.soap}
        for new in sections:
            old = old_by_label.get(new.label)
            if old is None or old.body != new.body or abs(old.confidence - new.confidence) > 0.02:
                changed.append(new)
        self.soap = list(sections)
        return changed

    # ─────────────── summary pipeline integration ───────────────

    def acquire_summary_lock(self) -> asyncio.Lock:
        return self._summary_lock

    def mark_summary_run(self) -> None:
        self.last_summary_at = time.monotonic()

    def update_summary(self, summary: ClinicalSummary) -> bool:
        """Returns True if the headline changed."""
        new = summary.headline.strip()
        if new == self.summary:
            return False
        self.summary = new
        return True

    # ─────────────── helpers for pipelines ───────────────

    def prior_symptoms(self) -> list[SymptomExtraction]:
        return [s.extraction for s in self.symptoms_by_key.values()]

    def prior_medications(self) -> list[MedicationExtraction]:
        return [m.extraction for m in self.medications_by_key.values()]
