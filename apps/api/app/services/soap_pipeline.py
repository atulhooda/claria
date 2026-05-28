"""SOAP refine loop.

Slower, more capable model. Replaces the whole draft each pass; the
state layer computes which sections actually changed so the wire only
emits deltas.
"""

from __future__ import annotations

import structlog

from app.integrations.llm.base import LlmClient, LlmError
from app.prompts.soap import SOAP_SYSTEM_PROMPT, format_soap_user_message
from app.schemas.clinical import SoapDraft, SoapSectionDraft
from app.services.consultation_state import ConsultationState

log = structlog.get_logger()

# How many of the most-recent finals to ship in the refine prompt.
SOAP_TRANSCRIPT_WINDOW = 24


async def run_soap_pass(
    *,
    state: ConsultationState,
    llm: LlmClient,
    model: str,
) -> list[SoapSectionDraft] | None:
    """Run one SOAP refine pass. Returns the list of CHANGED sections, or
    None if nothing to do."""
    async with state.acquire_soap_lock():
        if len(state.finals) == state.soap_watermark:
            return None

        state.mark_soap_run()

        recent_lines = [
            (line.speaker, line.text) for line in state.finals[-SOAP_TRANSCRIPT_WINDOW:]
        ]

        user_msg = format_soap_user_message(
            prior_draft=state.soap,
            symptoms=state.prior_symptoms(),
            medications=state.prior_medications(),
            recent_lines=recent_lines,
            running_summary=state.summary or None,
        )

        try:
            draft = await llm.structured(
                system=SOAP_SYSTEM_PROMPT,
                user=user_msg,
                schema=SoapDraft,
                model=model,
                temperature=0.2,
                max_output_tokens=1200,
            )
        except LlmError as exc:
            log.warning(
                "soap_llm_failed",
                consultation_id=state.consultation_id,
                retryable=exc.retryable,
                error=str(exc),
            )
            return None

        changed = state.update_soap(draft.sections)
        return changed if changed else None
