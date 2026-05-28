"""Cheap, infrequent summary loop.

Folds the current SOAP draft into a one-line headline. Runs every
~60s. Output goes into the workspace header.
"""

from __future__ import annotations

import structlog

from app.integrations.llm.base import LlmClient, LlmError
from app.prompts.summary import SUMMARY_SYSTEM_PROMPT, format_summary_user_message
from app.schemas.clinical import ClinicalSummary
from app.services.consultation_state import ConsultationState

log = structlog.get_logger()


async def run_summary_pass(
    *,
    state: ConsultationState,
    llm: LlmClient,
    model: str,
) -> str | None:
    """Run one summary pass. Returns the new headline if it changed."""
    async with state.acquire_summary_lock():
        # Don't bother if all SOAP sections are empty — there's nothing to summarize.
        if not any(s.body.strip() for s in state.soap):
            return None
        state.mark_summary_run()

        user_msg = format_summary_user_message(sections=state.soap)
        try:
            summary = await llm.structured(
                system=SUMMARY_SYSTEM_PROMPT,
                user=user_msg,
                schema=ClinicalSummary,
                model=model,
                temperature=0.2,
                max_output_tokens=120,
            )
        except LlmError as exc:
            log.warning(
                "summary_llm_failed",
                consultation_id=state.consultation_id,
                retryable=exc.retryable,
                error=str(exc),
            )
            return None

        return summary.headline if state.update_summary(summary) else None
