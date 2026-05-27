import whisper

# load AI model
model = whisper.load_model("base")

# transcribe audio file
result = model.transcribe("conversation.mp3")

# print transcript
print(result["text"])