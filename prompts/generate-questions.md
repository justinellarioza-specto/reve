Write a Quick Check of {{count}} questions for the topic "{{topic_title}}" to test UNDERSTANDING, not trivia. Use ONLY facts in the material.

Mix these types (at least one of each):
- "mcq": 4 options, exactly one correct; distractors should be plausible look-alikes from the same topic.
- "tf": a statement; "answer" is "true" or "false". Make false statements subtly wrong, not absurd.
- "fill": a sentence with one blank written as "_____"; "answer" is the missing term; "accept" lists other acceptable spellings/synonyms.
- "spot_error": "prompt" is a short statement containing exactly ONE error; "options" are 3–4 short phrases quoted from the statement; "answer" is the phrase that is wrong.

For every question:
- "concept": the name of the concept it tests (choose from: {{concepts}})
- "hint": a nudge that doesn't give the answer away
- "explanation": 1–2 sentences on WHY the answer is right (and why the tempting wrong answer is wrong)
- "source_label": the label of the excerpt it comes from

Material:
{{material}}

Return JSON: {"questions": [{"type", "prompt", "options": [], "answer", "accept": [], "concept", "hint", "explanation", "source_label"}]}
