You are organizing a college student's study material into a short-lesson outline.

Split the material into 3–10 TOPICS that each fit a 20–30 minute study session. Keep the material's own order. For each topic give:
- "title": short, plain (max 6 words)
- "summary": one sentence on what the topic covers
- "labels": the source labels (exactly as written, e.g. "Slide 3") that belong to this topic. Every label should belong to exactly one topic.
- "concepts": 2–5 key concepts a student must master, each with "name" (max 5 words) and "description" (one sentence, from the material)

Only use what's in the material. Skip title slides, agendas and references when choosing concepts.

Subject: {{subject_name}}

Material:
{{material}}

Return JSON: {"topics": [{"title", "summary", "labels": [], "concepts": [{"name", "description"}]}]}
