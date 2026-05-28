"""Background writer that persists realtime events without blocking them.

Owns its own AsyncSession. The WS handler calls `enqueue(event_kind,
payload)` on every Deepgram final and every AI orchestrator event;
the writer's flush task batches them and commits in groups.

Why a separate writer (vs each pipeline writing directly):
  - Realtime isolation: a slow Postgres never stalls the audio path.
  - One transactional surface to reason about.
  - Backpressure: the queue is bounded; if it overflows, oldest is
    dropped (the realtime tier remains responsive, persistence
    degrades gracefully).
  - Swappable: replace the implementation with Redis / Kafka without
    touching the orchestrator.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any, Literal

import structlog
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.repositories.clinical import (
    MedicationRepository,
    SoapRepository,
    SymptomRepository,
    TimelineEventRepository,
    TranscriptRepository,
)
from app.repositories.consultations import ConsultationRepository

log = structlog.get_logger()

# Tuning knobs — see PersistenceWriter.flush() for usage.
BATCH_SIZE = 16
FLUSH_INTERVAL_SEC = 1.0
QUEUE_MAX_SIZE = 1024

EventKind = Literal[
    "transcript_final",
    "soap_update",
    "symptom_upsert",
    "medication_upsert",
    "timeline_add",
    "summary_update",
]


@dataclass(slots=True)
class _QueueItem:
    kind: EventKind
    payload: dict[str, Any]


class PersistenceWriter:
    """One instance per consultation WebSocket connection."""

    def __init__(
        self,
        *,
        consultation_id: uuid.UUID,
        session_factory: async_sessionmaker[AsyncSession],
    ) -> None:
        self._consultation_id = consultation_id
        self._session_factory = session_factory

        self._queue: asyncio.Queue[_QueueItem | None] = asyncio.Queue(
            maxsize=QUEUE_MAX_SIZE
        )
        self._flush_task: asyncio.Task[None] | None = None
        self._closed = False

    # ─────────────── lifecycle ───────────────

    async def start(self) -> None:
        self._flush_task = asyncio.create_task(
            self._flush_loop(), name="persistence_writer"
        )

    async def close(self) -> None:
        """Signal end-of-stream and wait for the final flush.

        The WS handler calls this before `finalize`-ing the consultation
        so we don't leave queued events unwritten.
        """
        if self._closed:
            return
        self._closed = True
        await self._queue.put(None)  # poison pill
        if self._flush_task is not None:
            try:
                await self._flush_task
            except Exception as exc:
                log.exception("persistence_writer_close_error", error=str(exc))

    # ─────────────── enqueue API ───────────────

    def enqueue_transcript_final(
        self,
        *,
        line_external_id: str,
        timestamp_sec: float,
        speaker: str,
        text: str,
        confidence: float | None,
    ) -> None:
        self._enqueue(
            "transcript_final",
            {
                "line_external_id": line_external_id,
                "timestamp_sec": timestamp_sec,
                "speaker": speaker,
                "text": text,
                "confidence": confidence,
            },
        )

    def enqueue_soap_update(
        self, *, label: str, body: str, confidence: float
    ) -> None:
        self._enqueue(
            "soap_update", {"label": label, "body": body, "confidence": confidence}
        )

    def enqueue_symptom(
        self,
        *,
        external_id: str,
        label: str,
        severity: str,
        duration: str | None,
        confidence: float,
    ) -> None:
        self._enqueue(
            "symptom_upsert",
            {
                "external_id": external_id,
                "label": label,
                "severity": severity,
                "duration": duration,
                "confidence": confidence,
            },
        )

    def enqueue_medication(
        self,
        *,
        external_id: str,
        name: str,
        dose: str | None,
        frequency: str | None,
        status: str,
        confidence: float,
    ) -> None:
        self._enqueue(
            "medication_upsert",
            {
                "external_id": external_id,
                "name": name,
                "dose": dose,
                "frequency": frequency,
                "status": status,
                "confidence": confidence,
            },
        )

    def enqueue_timeline(
        self,
        *,
        external_id: str,
        timestamp_sec: float,
        label: str,
        kind: str,
    ) -> None:
        self._enqueue(
            "timeline_add",
            {
                "external_id": external_id,
                "timestamp_sec": timestamp_sec,
                "label": label,
                "kind": kind,
            },
        )

    def enqueue_summary(self, *, text: str) -> None:
        self._enqueue("summary_update", {"text": text})

    # ─────────────── internals ───────────────

    def _enqueue(self, kind: EventKind, payload: dict[str, Any]) -> None:
        """Try to enqueue; on full queue, drop oldest. Never blocks."""
        item = _QueueItem(kind=kind, payload=payload)
        try:
            self._queue.put_nowait(item)
        except asyncio.QueueFull:
            log.warning(
                "persistence_queue_full",
                consultation_id=str(self._consultation_id),
                kind=kind,
            )
            # Drop the oldest non-poison-pill item to make room.
            try:
                stale = self._queue.get_nowait()
                if stale is None:
                    # We just popped the poison pill — put it back, drop new event.
                    self._queue.put_nowait(None)
                    return
            except asyncio.QueueEmpty:
                pass
            try:
                self._queue.put_nowait(item)
            except asyncio.QueueFull:
                pass  # truly hopeless — give up on this event

    async def _flush_loop(self) -> None:
        """Drain the queue and apply batches until close() poisons it."""
        batch: list[_QueueItem] = []
        last_flush = time.monotonic()

        while True:
            timeout = max(
                0.05, FLUSH_INTERVAL_SEC - (time.monotonic() - last_flush)
            )
            try:
                item = await asyncio.wait_for(self._queue.get(), timeout=timeout)
            except TimeoutError:
                item = _SENTINEL_FLUSH

            if item is None:
                # Poison pill — flush whatever's pending and exit.
                if batch:
                    await self._apply_batch(batch)
                return

            if item is not _SENTINEL_FLUSH:
                batch.append(item)

            should_flush = (
                len(batch) >= BATCH_SIZE
                or (item is _SENTINEL_FLUSH and batch)
            )
            if should_flush:
                await self._apply_batch(batch)
                batch = []
                last_flush = time.monotonic()

    async def _apply_batch(self, batch: list[_QueueItem]) -> None:
        """Open a session, dispatch each item to its repo, commit."""
        try:
            async with self._session_factory() as session:
                transcripts = TranscriptRepository(session)
                soap = SoapRepository(session)
                symptoms = SymptomRepository(session)
                medications = MedicationRepository(session)
                timelines = TimelineEventRepository(session)
                consultations = ConsultationRepository(session)

                for item in batch:
                    await self._dispatch_one(
                        item,
                        transcripts=transcripts,
                        soap=soap,
                        symptoms=symptoms,
                        medications=medications,
                        timelines=timelines,
                        consultations=consultations,
                    )
                await session.commit()
        except Exception as exc:
            log.exception(
                "persistence_batch_failed",
                consultation_id=str(self._consultation_id),
                batch_size=len(batch),
                error=str(exc),
            )

    async def _dispatch_one(
        self,
        item: _QueueItem,
        *,
        transcripts: TranscriptRepository,
        soap: SoapRepository,
        symptoms: SymptomRepository,
        medications: MedicationRepository,
        timelines: TimelineEventRepository,
        consultations: ConsultationRepository,
    ) -> None:
        cid = self._consultation_id
        p = item.payload

        match item.kind:
            case "transcript_final":
                await transcripts.insert_if_new(consultation_id=cid, **p)
            case "soap_update":
                await soap.upsert(consultation_id=cid, **p)
            case "symptom_upsert":
                await symptoms.upsert(consultation_id=cid, **p)
            case "medication_upsert":
                await medications.upsert(consultation_id=cid, **p)
            case "timeline_add":
                await timelines.insert_if_new(consultation_id=cid, **p)
            case "summary_update":
                await consultations.update_summary(
                    consultation_id=cid, summary=p["text"]
                )


# Sentinel object used inside _flush_loop to distinguish "interval
# elapsed, flush if pending" from a real queue item.
_SENTINEL_FLUSH: _QueueItem = _QueueItem(kind="summary_update", payload={})


@asynccontextmanager
async def persistence_writer(
    *,
    consultation_id: uuid.UUID,
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[PersistenceWriter]:
    writer = PersistenceWriter(
        consultation_id=consultation_id,
        session_factory=session_factory,
    )
    await writer.start()
    try:
        yield writer
    finally:
        await writer.close()
