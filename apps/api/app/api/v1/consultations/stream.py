"""WebSocket endpoint that bridges a browser audio stream to Deepgram
AND fans out clinical AI events (extractions, SOAP, summary) generated
by the AiOrchestrator.

In Phase 4 the WS handler also:
  - Validates the consultation_id is a real UUID owned by the caller
    in `live` status (created via `POST /consultations` first).
  - Attaches a PersistenceWriter that batches every Deepgram final
    and every AI event to Postgres without blocking the realtime path.
  - On disconnect, flushes the writer and marks the consultation
    `completed` with a duration.

Wire protocol — unchanged from Phase 2-3. See docstrings in the
deepgram_stream / ai_orchestrator services.

Close codes:
    4400  bad consultation id (not a UUID, or not in `live` status)
    4401  unauthorized
    4404  consultation not found / not owned by caller
    4503  STT not configured
    4500  internal error
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from app.api.deps import authenticate_token
from app.core.config import get_settings
from app.core.exceptions import UnauthorizedError
from app.db.models import ConsultationStatus
from app.db.session import SessionFactory
from app.integrations.clerk import ClerkVerifier, get_clerk_verifier
from app.integrations.llm.openai_client import get_llm_client
from app.repositories.consultations import ConsultationRepository
from app.services.ai_orchestrator import AiOrchestrator, ai_orchestrator
from app.services.deepgram_stream import DeepgramStreamSession, deepgram_session
from app.services.persistence_writer import PersistenceWriter, persistence_writer

router = APIRouter(prefix="/consultations", tags=["consultations"])
log = structlog.get_logger()


CLOSE_BAD_REQUEST = 4400
CLOSE_UNAUTHORIZED = 4401
CLOSE_NOT_FOUND = 4404
CLOSE_UNAVAILABLE = 4503
CLOSE_INTERNAL = 4500


@router.websocket("/{consultation_id}/stream")
async def consultation_stream(
    websocket: WebSocket,
    consultation_id: str,
    token: Annotated[str | None, Query()] = None,
    verifier: Annotated[ClerkVerifier, Depends(get_clerk_verifier)] = ...,  # type: ignore[assignment]
) -> None:
    """Bidirectional audio in / transcript + AI events out, with persistence."""
    settings = get_settings()
    bound_log = log.bind(consultation_id=consultation_id)

    # ----- parse id -----
    try:
        consultation_uuid = uuid.UUID(consultation_id)
    except ValueError:
        bound_log.info("ws_bad_consultation_id")
        await websocket.close(code=CLOSE_BAD_REQUEST, reason="invalid consultation id")
        return

    # ----- auth -----
    try:
        user = authenticate_token(token, verifier)
    except UnauthorizedError as exc:
        bound_log.info("ws_auth_failed", reason=exc.message)
        await websocket.close(code=CLOSE_UNAUTHORIZED, reason=exc.message)
        return

    bound_log = bound_log.bind(user_id=user.id)

    # ----- ownership + state check -----
    async with SessionFactory() as db_session:
        repo = ConsultationRepository(db_session)
        consultation = await repo.get_for_user(
            consultation_id=consultation_uuid, user_id=user.id
        )
    if consultation is None:
        bound_log.info("ws_consultation_not_found")
        await websocket.close(code=CLOSE_NOT_FOUND, reason="not found")
        return
    if consultation.status != ConsultationStatus.LIVE:
        bound_log.info("ws_consultation_not_live", current_status=consultation.status.value)
        await websocket.close(
            code=CLOSE_BAD_REQUEST,
            reason=f"consultation is {consultation.status.value}, not live",
        )
        return

    # ----- provider config -----
    if not settings.deepgram_api_key:
        bound_log.warning("deepgram_not_configured")
        await websocket.accept()
        await _send_event(websocket, {
            "type": "error",
            "code": "STT_UNAVAILABLE",
            "message": (
                "Transcription is not configured on this server. "
                "Set DEEPGRAM_API_KEY in apps/api/.env."
            ),
        })
        await websocket.close(code=CLOSE_UNAVAILABLE)
        return

    llm = get_llm_client()
    if llm is None:
        bound_log.info("ai_pipeline_disabled", reason="no_openai_key")

    await websocket.accept()
    bound_log.info("ws_connected", ai_enabled=llm is not None)

    try:
        async with (
            deepgram_session(
                api_key=settings.deepgram_api_key.get_secret_value(),
                model=settings.deepgram_model,
                language=settings.deepgram_language,
                sample_rate=16000,
            ) as dg_session,
            ai_orchestrator(
                consultation_id=consultation_id,
                llm=llm,
                settings=settings,
            ) as orch,
            persistence_writer(
                consultation_id=consultation_uuid,
                session_factory=SessionFactory,
            ) as writer,
        ):
            async with asyncio.TaskGroup() as tg:
                tg.create_task(
                    _ingest_loop(websocket, dg_session, bound_log),
                    name="ws_ingest",
                )
                tg.create_task(
                    _drain_deepgram_loop(websocket, dg_session, orch, writer, bound_log),
                    name="ws_drain_dg",
                )
                if orch is not None:
                    tg.create_task(
                        _drain_ai_loop(websocket, orch, writer, bound_log),
                        name="ws_drain_ai",
                    )
    except* WebSocketDisconnect:
        bound_log.info("ws_disconnected")
    except* Exception as eg:
        for inner in eg.exceptions:
            bound_log.exception("ws_unhandled", error=str(inner))
        try:
            await websocket.close(code=CLOSE_INTERNAL)
        except Exception:
            pass
    finally:
        # Always finalize the consultation row so it can be reviewed.
        try:
            async with SessionFactory() as db_session, db_session.begin():
                repo = ConsultationRepository(db_session)
                await repo.finalize(consultation_uuid)
            bound_log.info("ws_finalized")
        except Exception as exc:
            bound_log.exception("ws_finalize_failed", error=str(exc))


async def _ingest_loop(
    websocket: WebSocket,
    session: DeepgramStreamSession,
    log: Any,
) -> None:
    """Pump client messages into the Deepgram session."""
    while True:
        message = await websocket.receive()
        if message["type"] == "websocket.disconnect":
            raise WebSocketDisconnect()

        if (data := message.get("bytes")) is not None:
            if data:
                await session.send_audio(data)
            continue

        text = message.get("text")
        if not text:
            continue
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            log.warning("ws_bad_json", payload=text[:200])
            continue

        if payload.get("type") != "control":
            continue

        action = payload.get("action")
        if action == "finalize":
            log.info("ws_finalize_requested")
            await session.finalize()
            return
        if action in {"pause", "resume"}:
            log.debug("ws_control", action=action)


async def _drain_deepgram_loop(
    websocket: WebSocket,
    session: DeepgramStreamSession,
    orch: AiOrchestrator | None,
    writer: PersistenceWriter,
    log: Any,
) -> None:
    """Forward Deepgram events: client + AI orchestrator + persistence."""
    async for event in session.events():
        await _send_event(websocket, dict(event))

        if event["type"] == "transcript.final":
            # Persist (writer is non-blocking).
            writer.enqueue_transcript_final(
                line_external_id=event["id"],
                timestamp_sec=event["t"],
                speaker=event["speaker"],
                text=event["text"],
                confidence=event.get("confidence"),
            )
            # And feed the AI orchestrator (if enabled).
            if orch is not None:
                await orch.notify_final(
                    line_id=event["id"],
                    t=event["t"],
                    speaker=event["speaker"],
                    text=event["text"],
                )
    log.info("ws_dg_drain_complete")


async def _drain_ai_loop(
    websocket: WebSocket,
    orch: AiOrchestrator,
    writer: PersistenceWriter,
    log: Any,
) -> None:
    """Forward orchestrator events: client + persistence."""
    async for event in orch.events():
        await _send_event(websocket, dict(event))
        # Branch on event["type"] directly so mypy can narrow the union.
        # ai.activity events are realtime-only and intentionally not persisted.
        if event["type"] == "soap.update":
            writer.enqueue_soap_update(
                label=event["section"],
                body=event["body"],
                confidence=event["confidence"],
            )
        elif event["type"] == "extraction.symptom":
            writer.enqueue_symptom(
                external_id=event["id"],
                label=event["label"],
                severity=event["severity"],
                duration=event["duration"],
                confidence=event["confidence"],
            )
        elif event["type"] == "extraction.medication":
            writer.enqueue_medication(
                external_id=event["id"],
                name=event["name"],
                dose=event["dose"],
                frequency=event["frequency"],
                status=event["status"],
                confidence=event["confidence"],
            )
        elif event["type"] == "timeline.add":
            writer.enqueue_timeline(
                external_id=event["id"],
                timestamp_sec=event["t"],
                label=event["label"],
                kind=event["kind"],
            )
        elif event["type"] == "summary.update":
            writer.enqueue_summary(text=event["text"])
    log.info("ws_ai_drain_complete")


async def _send_event(websocket: WebSocket, event: dict[str, Any]) -> None:
    try:
        await websocket.send_text(json.dumps(event))
    except RuntimeError:
        pass
