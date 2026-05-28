"""Deepgram live transcription wrapper (SDK v7).

Translates between Claria's wire format (typed dicts shared with the web
client) and the Deepgram SDK's event stream. The WebSocket route layer
above stays Deepgram-agnostic: it pushes audio bytes in, awaits typed
events out. Swap providers by writing a second implementation of the
same interface.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any, Final, Literal, NotRequired, TypedDict

import structlog
from deepgram import AsyncDeepgramClient
from deepgram.listen.v1.types.listen_v1metadata import ListenV1Metadata
from deepgram.listen.v1.types.listen_v1results import ListenV1Results
from deepgram.listen.v1.types.listen_v1speech_started import ListenV1SpeechStarted
from deepgram.listen.v1.types.listen_v1utterance_end import ListenV1UtteranceEnd

log = structlog.get_logger()

# Deepgram closes idle connections after ~10s. 5s heartbeat is safe.
KEEPALIVE_INTERVAL_SEC: Final[float] = 5.0


class TranscriptEvent(TypedDict):
    """Wire-format transcript event (mirrors the TS interface on the web)."""

    type: Literal["transcript.partial", "transcript.final"]
    id: str
    t: float
    speaker: Literal["doctor", "patient"]
    text: str
    confidence: NotRequired[float]


class ActivityEvent(TypedDict):
    type: Literal["ai.activity"]
    state: Literal["listening", "transcribing", "drafting", "idle"]


class ReadyEvent(TypedDict):
    type: Literal["ready"]


class ErrorEvent(TypedDict):
    type: Literal["error"]
    code: str
    message: str


# Discriminated union of all server → client events.
ServerEvent = TranscriptEvent | ActivityEvent | ReadyEvent | ErrorEvent


# Deepgram returns speaker indices (0, 1, 2, ...). For Phase 1 we map the
# first two heuristically and fall back to "doctor" for the rest. A real
# product would let the clinician confirm speaker mapping in the UI.
_SPEAKER_BY_INDEX: Final[tuple[Literal["doctor", "patient"], ...]] = ("doctor", "patient")


def _speaker_for_index(index: int | None) -> Literal["doctor", "patient"]:
    if index is None or index < 0:
        return "doctor"
    if index < len(_SPEAKER_BY_INDEX):
        return _SPEAKER_BY_INDEX[index]
    return "doctor"


class DeepgramStreamSession:
    """One live Deepgram transcription session built on the v7 socket client.

    Lifecycle:
        async with deepgram_session(api_key=..., model=...) as session:
            async with asyncio.TaskGroup() as tg:
                tg.create_task(forward_audio(session))   # caller pushes audio
                tg.create_task(drain_events(session))    # caller consumes events

    Thread-safety: not thread-safe. Designed for one task pushing audio
    and one consuming events.
    """

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        language: str,
        sample_rate: int = 16000,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._language = language
        self._sample_rate = sample_rate

        self._queue: asyncio.Queue[ServerEvent | None] = asyncio.Queue(maxsize=256)
        self._socket: Any = None  # AsyncV1SocketClient
        self._socket_ctx: Any = None  # async context manager
        self._receive_task: asyncio.Task[None] | None = None
        self._keepalive_task: asyncio.Task[None] | None = None
        self._closed = False

    # ---------------------------------------------------------------- lifecycle

    async def start(self) -> None:
        client = AsyncDeepgramClient(api_key=self._api_key)
        self._socket_ctx = client.listen.v1.connect(
            model=self._model,
            language=self._language,
            encoding="linear16",
            sample_rate=self._sample_rate,
            channels=1,
            interim_results=True,
            smart_format=True,
            diarize=True,
            punctuate=True,
            endpointing=300,
        )
        self._socket = await self._socket_ctx.__aenter__()

        await self._enqueue(ReadyEvent(type="ready"))
        await self._enqueue(ActivityEvent(type="ai.activity", state="listening"))

        self._receive_task = asyncio.create_task(self._receive_loop())
        self._keepalive_task = asyncio.create_task(self._keepalive_loop())

    async def send_audio(self, chunk: bytes) -> None:
        """Push a PCM Int16 mono chunk upstream."""
        if not self._socket or self._closed:
            return
        try:
            await self._socket.send_media(chunk)
        except Exception as exc:
            log.warning("deepgram_send_failed", error=str(exc))

    async def finalize(self) -> None:
        """Tell Deepgram we're done — flushes any pending transcripts."""
        if not self._socket or self._closed:
            return
        try:
            await self._socket.send_finalize()
        except Exception as exc:
            log.warning("deepgram_finalize_failed", error=str(exc))

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True

        for task in (self._keepalive_task, self._receive_task):
            if task is not None:
                task.cancel()
                try:
                    await task
                except (asyncio.CancelledError, Exception):
                    pass

        if self._socket is not None:
            try:
                await self._socket.send_close_stream()
            except Exception as exc:
                log.debug("deepgram_close_stream_failed", error=str(exc))

        if self._socket_ctx is not None:
            try:
                await self._socket_ctx.__aexit__(None, None, None)
            except Exception as exc:
                log.debug("deepgram_ctx_exit_failed", error=str(exc))

        await self._enqueue(None)  # signal events() to stop

    async def events(self) -> AsyncIterator[ServerEvent]:
        """Async iterator of transcript / activity / error events."""
        while True:
            item = await self._queue.get()
            if item is None:
                break
            yield item

    # ------------------------------------------------------------------ internals

    async def _receive_loop(self) -> None:
        """Pump messages off the Deepgram socket into our typed queue."""
        try:
            async for message in self._socket:
                if isinstance(message, ListenV1Results):
                    await self._handle_result(message)
                elif isinstance(message, ListenV1UtteranceEnd):
                    # Treated as a hint that a full utterance landed; the
                    # corresponding final transcript already covers it.
                    continue
                elif isinstance(message, ListenV1SpeechStarted):
                    await self._enqueue(
                        ActivityEvent(type="ai.activity", state="transcribing")
                    )
                elif isinstance(message, ListenV1Metadata):
                    continue
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            log.warning("deepgram_receive_error", error=str(exc))
            await self._enqueue(
                ErrorEvent(type="error", code="DEEPGRAM_ERROR", message=str(exc))
            )

    async def _handle_result(self, result: ListenV1Results) -> None:
        try:
            channel = getattr(result, "channel", None)
            if channel is None:
                return
            alternatives = getattr(channel, "alternatives", None) or []
            if not alternatives:
                return
            alt = alternatives[0]
            text = (getattr(alt, "transcript", "") or "").strip()
            if not text:
                return

            is_final = bool(getattr(result, "is_final", False))
            speech_final = bool(getattr(result, "speech_final", False))
            t = float(getattr(result, "start", 0.0) or 0.0)
            confidence = float(getattr(alt, "confidence", 0.0) or 0.0)

            speaker_index: int | None = None
            words = getattr(alt, "words", None) or []
            if words:
                speaker_index = getattr(words[0], "speaker", None)
            speaker = _speaker_for_index(speaker_index)

            # Diagnostic: in `nova-3 multi` (multilingual) mode, Deepgram does
            # not split speakers — we expect `None` here for every utterance.
            # Logging gives ground truth when debugging mislabeled speakers.
            if (is_final or speech_final) and words:
                distinct = sorted({
                    s for w in words
                    if (s := getattr(w, "speaker", None)) is not None
                })
                log.info(
                    "transcript_speaker_indices",
                    first=speaker_index,
                    distinct=distinct,
                    word_count=len(words),
                )

            event_type: Literal["transcript.partial", "transcript.final"] = (
                "transcript.final" if (is_final or speech_final) else "transcript.partial"
            )
            prefix = "f-" if event_type == "transcript.final" else "p-"
            event_id = f"{prefix}{uuid.uuid4().hex[:10]}"

            await self._enqueue(
                TranscriptEvent(
                    type=event_type,
                    id=event_id,
                    t=t,
                    speaker=speaker,
                    text=text,
                    confidence=confidence,
                )
            )

            await self._enqueue(
                ActivityEvent(
                    type="ai.activity",
                    state="listening" if event_type == "transcript.final" else "transcribing",
                )
            )
        except Exception as exc:
            log.warning("transcript_parse_error", error=str(exc))

    async def _keepalive_loop(self) -> None:
        """Periodic no-op so Deepgram doesn't idle-close on silence."""
        try:
            while not self._closed:
                await asyncio.sleep(KEEPALIVE_INTERVAL_SEC)
                if self._socket and not self._closed:
                    try:
                        await self._socket.send_keep_alive()
                    except Exception as exc:
                        log.warning("deepgram_keepalive_failed", error=str(exc))
                        return
        except asyncio.CancelledError:
            raise

    async def _enqueue(self, event: ServerEvent | None) -> None:
        try:
            self._queue.put_nowait(event)
        except asyncio.QueueFull:
            log.warning("deepgram_event_queue_full")
            try:
                self._queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            self._queue.put_nowait(event)


@asynccontextmanager
async def deepgram_session(
    *, api_key: str, model: str, language: str, sample_rate: int = 16000
) -> AsyncIterator[DeepgramStreamSession]:
    session = DeepgramStreamSession(
        api_key=api_key,
        model=model,
        language=language,
        sample_rate=sample_rate,
    )
    try:
        await session.start()
        yield session
    finally:
        await session.close()
