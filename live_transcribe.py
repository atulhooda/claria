import whisper
import sounddevice as sd
import numpy as np
import scipy.io.wavfile as wav

from llm_extractor import extract_medical_info_llm
from pdf_generator import generate_pdf
from datetime import datetime

# -----------------------------
# Load Whisper Model
# -----------------------------
print("Loading Whisper model...")
model = whisper.load_model("base")

# -----------------------------
# Continuous Recording
# -----------------------------
sample_rate = 16000

print("Recording... Press ENTER to stop.")

recording = []

def callback(indata, frames, time, status):
    recording.append(indata.copy())

with sd.InputStream(samplerate=sample_rate, channels=1, callback=callback):
    input()  # Wait until user presses Enter

# Combine audio chunks
audio = np.concatenate(recording, axis=0)

# Save audio file
wav.write("live_audio.wav", sample_rate, audio)

# -----------------------------
# Transcription
# -----------------------------
print("Transcribing...")
result = model.transcribe("live_audio.wav")

print("\nTranscript:")
print(result["text"])

# -----------------------------
# LLM Extraction
# -----------------------------
info = extract_medical_info_llm(result["text"])

print("\nLLM Extracted Medical Info:")
print(info)

# -----------------------------
# PDF Generation
# -----------------------------
report_data = {
    "patient_name": "Test Patient",
    "age": "20",
    "sex": "Male",
    "date": datetime.now().strftime("%d-%m-%Y"),
    "doctor_name": "Dr. Claria AI",
    "allergy": "No Known Allergy",
    "chief_complaints": ", ".join(info.get("symptoms", [])),
    "history": result["text"],
    "diagnosis": info.get("possible_diagnosis", "Under Evaluation"),
    "investigations": "As advised",
    "medications": ", ".join(info.get("current_medication", [])),
    "advice": "Review after 7 days",
    "follow_up": "After 1 week"
}

generate_pdf(report_data)

print("PDF Generated Successfully!")