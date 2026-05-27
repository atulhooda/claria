def generate_notes(info):

    symptoms = ", ".join(info["symptoms"]) if info["symptoms"] else "No symptoms detected"
    meds = ", ".join(info["medication"]) if info["medication"] else "No medication reported"
    duration = ", ".join([f"{d[0]} {d[1]}" for d in info["duration"]]) if info["duration"] else "Duration not specified"

    notes = f"""
--- CLARIA MEDICAL NOTE ---

Subjective:
Patient reports {symptoms} for {duration}.

Medication History:
{meds}

Assessment:
Further clinical evaluation required.

Plan:
Follow physician recommendations.
"""

    return notes