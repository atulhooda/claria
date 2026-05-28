"""Owns the AI generation loops for one consultation.

The Deepgram side of the WebSocket handler shovels finalized transcript
lines in via `notify_final()`. The web side drains AI events out via
`events()`. Inside, three loops gate themselves on interval + new-line
thresholds and fire the pipelines.

Lifecycle:
    async with ai_orchestrator(state=..., llm=..., settings=...) as orch:
        async with asyncio.TaskGroup() as tg:
            tg.create_task(forward_events(orch))   # WS drains orch.events()
            ...
        await orch.notify_final(...)              # transcript code pings here

Graceful degradation: if no LLM client is available (no OPENAI_API_KEY),
`ai_orchestrator()` yields None — callers must handle that and skip
AI fan-out without breaking the transcript path.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Final, Literal, TypedDict

import structlog

from app.core.config import Settings
from app.integrations.llm.base import LlmClient
from app.schemas.clinical import Speaker
from app.services.consultation_state import (
    ConsultationState,
    StoredMedication,
    StoredSymptom,
    StoredTimelineEvent,
)
from app.services.extraction_pipeline import ExtractionResult, run_extraction_pass
from app.services.soap_pipeline import run_soap_pass
from app.services.summary_pipeline import run_summary_pass

log = structlog.get_logger()

# How often the inner scheduler wakes when no transcript activity. Short
# enough that interval-only triggers (summary) fire close to their target.
SCHEDULER_TICK_SEC: Final[float] = 2.5


# ─────────────────────────── wire events ───────────────────────────


class SymptomEvent(TypedDict):
    type: Literal["extraction.symptom"]
    action: Literal["add", "update"]
    id: str
    label: str
    severity: Literal["mild", "moderate", "severe"]
    duration: str | None
    confidence: float


class MedicationEvent(TypedDict):
    type: Literal["extraction.medication"]
    action: Literal["add", "update"]
    id: str
    name: str
    dose: str | None
    frequency: str | None
    status: Literal["current", "prescribed", "discontinued"]
    confidence: float


class TimelineAddEvent(TypedDict):
    type: Literal["timeline.add"]
    id: str
    t: float
    label: str
    kind: Literal["topic", "vital", "medication", "follow-up"]


class SoapUpdateEvent(TypedDict):
    type: Literal["soap.update"]
    section: Literal["S", "O", "A", "P"]
    body: str
    confidence: float


class SummaryEvent(TypedDict):
    type: Literal["summary.update"]
    text: str


class AiActivityEvent(TypedDict):
    type: Literal["ai.activity"]
    state: Literal["idle", "listening", "transcribing", "drafting"]


AiEvent = (
    SymptomEvent
    | MedicationEvent
    | TimelineAddEvent
    | SoapUpdateEvent
    | SummaryEvent
    | AiActivityEvent
)


# ─────────────────────────── orchestrator ───────────────────────────


class AiOrchestrator:
    """Runs the three pipelines against a single ConsultationState."""

    def __init__(
        self,
        *,
        state: ConsultationState,
        llm: LlmClient,
        settings: Settings,
    ) -> None:
        self._state = state
        self._llm = llm
        self._settings = settings

        self._queue: asyncio.Queue[AiEvent | None] = asyncio.Queue(maxsize=512)
        self._wake_event = asyncio.Event()
        self._scheduler_task: asyncio.Task[None] | None = None
        self._closed = False

        # Track in-flight passes — if one is running when its tick fires,
        # we drop the new tick (coalesce, not queue).
        self._extraction_inflight = False
        self._soap_inflight = False
        self._summary_inflight = False

        # Hold references to background pass tasks so they aren't GC'd
        # while running. Done tasks discard themselves.
        self._pass_tasks: set[asyncio.Task[None]] = set()

    # ─────────────── lifecycle ───────────────

    async def start(self) -> None:
        self._scheduler_task = asyncio.create_task(
            self._scheduler_loop(), name="ai_scheduler"
        )

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        self._wake_event.set()
        if self._scheduler_task:
            self._scheduler_task.cancel()
            try:
                await self._scheduler_task
            except asyncio.CancelledError:
                pass
        await self._queue.put(None)

    # ─────────────── inputs ───────────────

    async def notify_final(
        self, *, line_id: str, t: float, speaker: Speaker, text: str
    ) -> None:
        """Called once per finalized transcript line."""
        self._state.add_final(line_id=line_id, t=t, speaker=speaker, text=text)
        self._wake_event.set()

    # ─────────────── outputs ───────────────

    async def events(self) -> AsyncIterator[AiEvent]:
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item

    # ─────────────── scheduler ───────────────

    async def _scheduler_loop(self) -> None:
        """Wake on new transcript OR on a periodic tick; fire eligible passes."""
        try:
            while not self._closed:
                try:
                    await asyncio.wait_for(
                        self._wake_event.wait(), timeout=SCHEDULER_TICK_SEC
                    )
                except TimeoutError:
                    pass
                self._wake_event.clear()
                if self._closed:
                    return
                await self._maybe_fire_extraction()
                await self._maybe_fire_soap()
                await self._maybe_fire_summary()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.exception("ai_scheduler_crashed", error=str(exc))

    async def _maybe_fire_extraction(self) -> None:
        if self._extraction_inflight:
            return
        new_count = len(self._state.finals) - self._state.extraction_watermark
        if new_count < self._settings.ai_extraction_min_new_lines:
            return
        if (
            self._state.last_extraction_at
            and time.monotonic() - self._state.last_extraction_at
            < self._settings.ai_extraction_interval_sec
        ):
            return
        self._extraction_inflight = True
        self._spawn(self._run_extraction(), name="ai_extraction")

    async def _maybe_fire_soap(self) -> None:
        if self._soap_inflight:
            return
        new_count = len(self._state.finals) - self._state.soap_watermark
        if new_count < self._settings.ai_soap_min_new_lines:
            return
        if (
            self._state.last_soap_at
            and time.monotonic() - self._state.last_soap_at
            < self._settings.ai_soap_interval_sec
        ):
            return
        self._soap_inflight = True
        self._spawn(self._run_soap(), name="ai_soap")

    async def _maybe_fire_summary(self) -> None:
        if self._summary_inflight:
            return
        if (
            self._state.last_summary_at
            and time.monotonic() - self._state.last_summary_at
            < self._settings.ai_summary_interval_sec
        ):
            return
        if not any(s.body.strip() for s in self._state.soap):
            return
        self._summary_inflight = True
        self._spawn(self._run_summary(), name="ai_summary")

    # ─────────────── pipeline runners ───────────────

    async def _run_extraction(self) -> None:
        try:
            await self._emit_activity("drafting")
            result = await run_extraction_pass(
                state=self._state,
                llm=self._llm,
                model=self._settings.openai_model_fast,
            )
            if result and not result.is_empty:
                await self._emit_extraction(result)
        finally:
            self._extraction_inflight = False
            await self._emit_activity("listening")

    async def _run_soap(self) -> None:
        try:
            await self._emit_activity("drafting")
            changed = await run_soap_pass(
                state=self._state,
                llm=self._llm,
                model=self._settings.openai_model_capable,
            )
            if changed:
                for section in changed:
                    await self._emit(
                        SoapUpdateEvent(
                            type="soap.update",
                            section=section.label,
                            body=section.body,
                            confidence=section.confidence,
                        )
                    )
        finally:
            self._soap_inflight = False
            await self._emit_activity("listening")

    async def _run_summary(self) -> None:
        try:
            new_headline = await run_summary_pass(
                state=self._state,
                llm=self._llm,
                model=self._settings.openai_model_fast,
            )
            if new_headline:
                await self._emit(SummaryEvent(type="summary.update", text=new_headline))
        finally:
            self._summary_inflight = False

    # ─────────────── task plumbing ───────────────

    def _spawn(self, coro: Any, *, name: str) -> None:
        task = asyncio.create_task(coro, name=name)
        self._pass_tasks.add(task)
        task.add_done_callback(self._pass_tasks.discard)

    # ─────────────── emit helpers ───────────────

    async def _emit(self, event: AiEvent) -> None:
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            log.warning("ai_event_queue_full")
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._queue.put_nowait(event)

    async def _emit_activity(
        self, state: Literal["idle", "listening", "transcribing", "drafting"]
    ) -> None:
        await self._emit(AiActivityEvent(type="ai.activity", state=state))

    async def _emit_extraction(self, result: ExtractionResult) -> None:
        for sym in result.new_symptoms:
            await self._emit(_symptom_to_event(sym))
        for med in result.new_medications:
            await self._emit(_medication_to_event(med))
        for ev in result.new_timeline_events:
            await self._emit(_timeline_to_event(ev))


# ─────────────────────────── adapters ───────────────────────────


def _symptom_to_event(stored: StoredSymptom) -> SymptomEvent:
    s = stored.extraction
    return SymptomEvent(
        type="extraction.symptom",
        action="add",
        id=stored.id,
        label=s.label,
        severity=s.severity,
        duration=s.duration,
        confidence=s.confidence,
    )


def _medication_to_event(stored: StoredMedication) -> MedicationEvent:
    m = stored.extraction
    return MedicationEvent(
        type="extraction.medication",
        action="add",
        id=stored.id,
        name=m.name,
        dose=m.dose,
        frequency=m.frequency,
        status=m.status,
        confidence=m.confidence,
    )


def _timeline_to_event(stored: StoredTimelineEvent) -> TimelineAddEvent:
    return TimelineAddEvent(
        type="timeline.add",
        id=stored.id,
        t=stored.timestamp_sec,
        label=stored.label,
        kind=stored.kind,
    )


# ─────────────────────────── context manager ───────────────────────────


@asynccontextmanager
async def ai_orchestrator(
    *,
    consultation_id: str,
    llm: LlmClient | None,
    settings: Settings,
) -> AsyncIterator[AiOrchestrator | None]:
    """Yield an orchestrator, or None if no LLM client is configured.

    The WS handler treats `None` as "AI features disabled" and continues
    serving transcripts.
    """
    if llm is None:
        log.info("ai_orchestrator_disabled", reason="no_llm_client")
        yield None
        return

    state = ConsultationState(consultation_id=consultation_id)
    orch = AiOrchestrator(state=state, llm=llm, settings=settings)
    await orch.start()
    try:
        yield orch
    finally:
        await orch.close()


# Silence "imported but unused" for re-exporter convenience
_ = Any
