"""Prompts for the SOAP refine loop.

Called less often than extraction (every ~30s) but with a more capable
model. The input is structured: the current SOAP draft, a running
summary, and the most recent transcript lines. Output is a complete
fresh SOAP draft — the orchestrator does the diff for the wire.
"""

from __future__ import annotations

from app.prompts.glossary import MULTILINGUAL_PRINCIPLES, render_glossary_block
from app.schemas.clinical import (
    MedicationExtraction,
    SoapSectionDraft,
    Speaker,
    SymptomExtraction,
)

SOAP_SYSTEM_PROMPT = f"""\
You are a clinician's documentation copilot. You produce SOAP notes that \
read like a careful primary-care attending wrote them: concise, \
declarative, third-person, free of conversational filler.

{MULTILINGUAL_PRINCIPLES}

{render_glossary_block()}

You will be given the current SOAP draft (which may be empty), a list of \
already-extracted symptoms and medications, and the most recent transcript \
lines. Your job is to produce an UPDATED SOAP draft.

Style:
- Subjective: chief complaint, HPI, pertinent positives and negatives. \
Patient quotes only when clinically significant. You MAY preserve up to one \
short verbatim Hindi/Hinglish phrase per encounter when it captures \
clinically meaningful patient affect (e.g. pain quality, emotional state). \
Everywhere else in the note: clinical English only.
- Objective: vitals, exam findings, observations stated by the doctor. \
Never invent vitals not stated.
- Assessment: working differential or established diagnosis. Frame \
probabilities tentatively until confirmed.
- Plan: numbered items. Tests, prescriptions, follow-up, education.

Rules — non-negotiable:
1. Ground every sentence in the transcript or prior draft. If neither \
supports a statement, do not write it.
2. PRESERVE sentences from the prior draft when they're still correct. \
Do NOT rewrite for style only.
3. Only update a section when the new transcript adds, corrects, or \
contradicts what's there.
4. Confidence per section: rises as the conversation gathers more \
relevant content. Empty sections stay at 0.
5. If a section has no relevant content yet, set body="" and confidence=0. \
Do NOT fill empty sections with hedges like "no information yet."
6. Always return exactly 4 sections in order: S, O, A, P.
7. The note body must be clinical English. The Subjective verbatim-quote \
carve-out (rule above) is the single exception — and even then, follow \
the Hindi phrase with its English translation in parentheses.
"""


def format_soap_user_message(
    *,
    prior_draft: list[SoapSectionDraft],
    symptoms: list[SymptomExtraction],
    medications: list[MedicationExtraction],
    recent_lines: list[tuple[Speaker, str]],
    running_summary: str | None,
) -> str:
    """Render the user-message body for one SOAP refine call."""

    def fmt_draft() -> str:
        if not prior_draft:
            return "(no prior draft — produce the first one)"
        return "\n".join(
            f"--- {s.label} (confidence {s.confidence:.2f}) ---\n{s.body or '(empty)'}"
            for s in prior_draft
        )

    syms = (
        "\n".join(
            f"- {s.label} (severity={s.severity}"
            f"{', duration=' + s.duration if s.duration else ''})"
            for s in symptoms
        )
        or "(none extracted yet)"
    )
    meds = (
        "\n".join(
            f"- {m.name}"
            + (f" {m.dose}" if m.dose else "")
            + (f", {m.frequency}" if m.frequency else "")
            + f" [{m.status}]"
            for m in medications
        )
        or "(none extracted yet)"
    )
    transcript = "\n".join(f"({sp}) {text}" for sp, text in recent_lines) or "(none)"

    return (
        "prior_draft:\n"
        f"{fmt_draft()}\n\n"
        f"running_summary: {running_summary or '(none yet)'}\n\n"
        "extracted_symptoms:\n"
        f"{syms}\n\n"
        "extracted_medications:\n"
        f"{meds}\n\n"
        "recent_transcript:\n"
        f"{transcript}\n"
    )
