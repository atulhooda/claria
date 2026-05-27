import re

def extract_medical_info(text):

    symptoms = ["fever", "headache", "cough", "cold", "pain", "fatigue"]
    medicines = ["paracetamol", "ibuprofen", "aspirin"]

    detected_symptoms = []
    detected_meds = []

    for s in symptoms:
        if s in text.lower():
            detected_symptoms.append(s)

    for m in medicines:
        if m in text.lower():
            detected_meds.append(m)

    duration = re.findall(r"(\d+)\s*(hour|hours|day|days|week|weeks|month|months)", text.lower())

    return {
        "symptoms": detected_symptoms,
        "medication": detected_meds,
        "duration": duration
    }