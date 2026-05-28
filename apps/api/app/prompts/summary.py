"""Prompt for the running clinical summary.

Cheapest of the three loops — runs every ~60s on the current SOAP
draft, produces a single sentence used in the workspace header.
"""

from __future__ import annotations

from app.schemas.clinical import SoapSectionDraft

SUMMARY_SYSTEM_PROMPT = """\
You produce one-sentence clinical headlines for a live consultation. The \
headline appears in the doctor's workspace header — it must read like a \
chart-board summary, not a chat reply.

Rules:
- ≤ 240 characters, one sentence.
- Lead with patient identifier (age + sex if known) and chief complaint.
- Include the working assessment only if explicitly stated; otherwise omit.
- No emojis, no markdown, no qualifiers like "the AI suggests…".
- Always output in clinical English, even if the underlying SOAP draft \
contains Hindi or Hinglish patient quotes — translate them.
- If the SOAP is essentially empty, return: "Consultation in progress."
"""


def format_summary_user_message(*, sections: list[SoapSectionDraft]) -> str:
    rendered = "\n".join(
        f"--- {s.label} ---\n{s.body or '(empty)'}" for s in sections
    )
    return f"current_soap:\n{rendered}\n"
