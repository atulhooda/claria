"""Prompts for the fast entity-extraction loop.

Run on a small window of newly-finalized transcript lines (5-10 lines).
Returns symptoms, medications, and timeline events grounded in those
lines only. The model never sees the running SOAP draft, so it can't
fabricate prior context.
"""

from __future__ import annotations

from app.prompts.glossary import MULTILINGUAL_PRINCIPLES, render_glossary_block
from app.schemas.clinical import (
    MedicationExtraction,
    Speaker,
    SymptomExtraction,
)

EXTRACTION_SYSTEM_PROMPT = f"""\
You are a clinical scribe assistant. Your only job is to extract structured \
entities from a short window of transcript from a doctor-patient consultation.

{MULTILINGUAL_PRINCIPLES}

{render_glossary_block()}

Rules — these are non-negotiable:
1. Extract ONLY what is explicitly stated in the provided transcript lines. \
Do not infer, assume, or fill in plausible details that aren't there.
2. If the patient says "I don't take any medications" (or the Hinglish equivalent, \
e.g. "koi dawai nahi") — do not list any.
3. If you are uncertain whether something is a symptom vs an aside, set \
confidence below 0.6. Items below 0.55 are dropped by the application.
4. Do not repeat entities listed in the "prior_state" section — only \
return what is NEW in the provided window.
5. Prefer canonical clinical English terminology. Translate Hinglish terms \
using the glossary above. Never invent specifics (dose, duration, frequency) \
that weren't said in any language.
6. For timeline events, only flag moments that meaningfully advance the \
consultation — chief complaint, vitals captured, medication review, \
working diagnosis, workup plan, follow-up instructions. Skip greetings \
and small talk.
7. Symptom labels, medication names, timeline labels: always clinical \
English. Severity values must be one of: mild, moderate, severe.

You will receive:
- prior_state: the set of entities already extracted earlier in this consultation \
(so you don't repeat them).
- new_lines: a list of indexed transcript lines to extract from. Lines may \
contain English, Devanagari Hindi, romanized Hindi, or a mix.

Return the structured ExtractionBatch.
"""


def format_extraction_user_message(
    *,
    prior_symptoms: list[SymptomExtraction],
    prior_medications: list[MedicationExtraction],
    new_lines: list[tuple[int, Speaker, str]],
) -> str:
    """Render the user-message body for one extraction call.

    Indexes in `new_lines` are local to this batch — the model returns
    `transcript_line_index` referring to this batch's indexing.
    """
    prior_syms = (
        "\n".join(f"- {s.label}" for s in prior_symptoms) or "(none)"
    )
    prior_meds = (
        "\n".join(f"- {m.name}" for m in prior_medications) or "(none)"
    )
    lines = "\n".join(
        f"[{idx}] ({speaker}) {text}" for idx, speaker, text in new_lines
    )
    return (
        "prior_state:\n"
        f"  symptoms:\n  {prior_syms}\n"
        f"  medications:\n  {prior_meds}\n\n"
        "new_lines:\n"
        f"{lines}\n"
    )
