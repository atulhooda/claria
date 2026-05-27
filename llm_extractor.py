from openai import OpenAI
import json

client = OpenAI()

def extract_medical_info_llm(transcript):

    prompt = f"""
You are a medical AI assistant.

Extract the following from the conversation:

- symptoms
- duration
- previous_medication
- current_medication
- possible_diagnosis

Return STRICTLY valid JSON like this:

{{
  "symptoms": [],
  "duration": "",
  "previous_medication": [],
  "current_medication": [],
  "possible_diagnosis": ""
}}

Conversation:
{transcript}
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0
    )

    content = response.choices[0].message.content

    return json.loads(content)