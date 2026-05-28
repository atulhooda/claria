"""Fast entity-extraction loop.

Triggered by the orchestrator when new finals accumulate. One pass over
a small window of recent lines produces incremental symptoms,
medications, and timeline events. Designed to feel snappy: target
end-to-end <2s, no transcript-blocking.
"""

from __future__ import annotations

import structlog

from app.integrations.llm.base import LlmClient, LlmError
from app.prompts.extraction import (
    EXTRACTION_SYSTEM_PROMPT,
    format_extraction_user_message,
)
from app.schemas.clinical import ExtractionBatch
from app.services.consultation_state import (
    ConsultationState,
    StoredMedication,
    StoredSymptom,
    StoredTimelineEvent,
)

log = structlog.get_logger()


class ExtractionResult:
    """Plain container — what the wire layer will push to the client."""

    def __init__(
        self,
        *,
        new_symptoms: list[StoredSymptom],
        new_medications: list[StoredMedication],
        new_timeline_events: list[StoredTimelineEvent],
    ) -> None:
        self.new_symptoms = new_symptoms
        self.new_medications = new_medications
        self.new_timeline_events = new_timeline_events

    @property
    def is_empty(self) -> bool:
        return not (
            self.new_symptoms or self.new_medications or self.new_timeline_events
        )


async def run_extraction_pass(
    *,
    state: ConsultationState,
    llm: LlmClient,
    model: str,
) -> ExtractionResult | None:
    """Run one extraction pass. Returns None if nothing new to process.

    Concurrency: holds the per-state extraction lock for the whole call,
    so the orchestrator can fire-and-forget without worrying about
    overlapping passes.
    """
    async with state.acquire_extraction_lock():
        new_finals = state.new_finals_since(state.extraction_watermark)
        if not new_finals:
            return None

        # Mark immediately so a concurrent trigger doesn't redo this batch
        # even if the LLM call fails — we'd rather drop one batch than
        # double-bill.
        state.mark_extraction_run()

        new_lines = [
            (idx, line.speaker, line.text) for idx, line in enumerate(new_finals)
        ]
        user_msg = format_extraction_user_message(
            prior_symptoms=state.prior_symptoms(),
            prior_medications=state.prior_medications(),
            new_lines=new_lines,
        )

        try:
            batch = await llm.structured(
                system=EXTRACTION_SYSTEM_PROMPT,
                user=user_msg,
                schema=ExtractionBatch,
                model=model,
                temperature=0.1,
                max_output_tokens=600,
            )
        except LlmError as exc:
            log.warning(
                "extraction_llm_failed",
                consultation_id=state.consultation_id,
                retryable=exc.retryable,
                error=str(exc),
            )
            return None

        new_syms = state.store_extracted_symptoms(batch.symptoms)
        new_meds = state.store_extracted_medications(batch.medications)
        new_events = state.store_timeline_events(batch.timeline_events, new_lines=new_finals)

        return ExtractionResult(
            new_symptoms=new_syms,
            new_medications=new_meds,
            new_timeline_events=new_events,
        )
