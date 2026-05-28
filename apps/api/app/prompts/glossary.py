"""Hinglish ↔ clinical-English glossary used by every AI pipeline.

Inlined into prompts so the model has deterministic anchors for the
most common code-switching patterns in Indian doctor-patient
conversations. Anything not in this glossary is translated from
context — but for these high-frequency tokens we want canonical
mappings every time.

To extend: add a single row. Keep it short — too many entries makes
the prompt long and the model may over-fit to anchored translations.
The goal is ~25-40 high-value mappings, not exhaustive coverage.
"""

from __future__ import annotations

# Maps colloquial Hinglish (or romanized Hindi) → preferred clinical English.
# Keys are intentionally lowercase; the model is told the mapping is
# case- and stem-insensitive (e.g. dawai / dawai / dawayi / dawaiyan).
HINGLISH_TO_CLINICAL: dict[str, str] = {
    # Generic care vocabulary
    "dawai": "medication",
    "dava": "medication",
    "goli": "tablet",
    "syrup": "syrup",
    "injection": "injection",
    "tika": "vaccine",
    "khurak": "dose",
    "khuraak": "dose",
    "din mein": "per day",
    "roz": "daily",
    "subah": "morning",
    "raat": "night",
    "khali pet": "fasting",
    "bhojan ke baad": "after meals",
    "khaane ke baad": "after meals",
    # Common complaints / symptoms
    "sir dard": "headache",
    "sar dard": "headache",
    "dard": "pain",
    "bukhar": "fever",
    "khaansi": "cough",
    "zukam": "cold",
    "thakavat": "fatigue",
    "thakaan": "fatigue",
    "kamzori": "weakness",
    "chakkar": "dizziness",
    "ulti": "vomiting",
    "ji michalna": "nausea",
    "dast": "diarrhea",
    "pet dard": "abdominal pain",
    "pet mein dard": "abdominal pain",
    "saans phoolna": "shortness of breath",
    "saans": "breathing",
    "ghabrahat": "anxiety / palpitations",
    "neend nahi": "insomnia",
    # Conditions and measurements
    "bp": "blood pressure",
    "blood pressure": "blood pressure",
    "sugar": "blood glucose",
    "shugar": "blood glucose",
    "diabetes": "diabetes mellitus",
    "haart": "heart",
    "dil": "heart",
    "thyroid": "thyroid",
    "khoon": "blood",
    "test": "investigation",
    "report": "report",
    # Doctor-side directives
    "continue rakhiye": "continue",
    "band kar dijiye": "discontinue",
    "shuru kariye": "initiate",
    "follow-up": "follow-up",
    "check karwana": "investigation / workup",
}


def render_glossary_block() -> str:
    """Format the glossary as a compact reference block for prompts."""
    rows = [f"  • {hi} = {en}" for hi, en in HINGLISH_TO_CLINICAL.items()]
    return "Hinglish reference (case- and stem-insensitive):\n" + "\n".join(rows)


MULTILINGUAL_PRINCIPLES = """\
This consultation may be in English, Hindi (Devanagari or romanized), or \
freely code-switched Hinglish. Treat all three the same way:

1. Interpret meaning from whichever language is used — never reject \
content because it's not in English.
2. Always emit clinical OUTPUT fields in professional clinical English, \
regardless of input language. Symptom labels, medication names, plan \
items, timeline labels — all English.
3. Use the Hinglish reference below as canonical mappings for \
high-frequency terms. For anything not listed, translate from clinical \
context (e.g. patient quotes about pain quality).
4. If a Hindi phrase is ambiguous and you cannot confidently determine \
its clinical meaning, omit it. Do not guess.
"""
