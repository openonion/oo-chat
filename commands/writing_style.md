---
name: writing_style
description: Analyze sent emails to learn and save the user's writing style
tools:
  - get_sent_emails
---
Analyze the sent emails below and extract the user's personal writing style. Focus on consistent patterns across emails, not one-off exceptions.

{emails}

Respond in this EXACT format — ALL sections are required:

# My Writing Style

**Tone:** [casual / professional / formal — pick the closest match]
**Average Length:** [very short (1 sentence) / short (2–3 sentences) / medium (1–2 paragraphs) / long (3+ paragraphs)]
**Formality:** [Low / Medium / High] — [one-line note, e.g. "uses contractions, avoids jargon"]

## Greetings
[List the most common opening lines found, e.g. "Hey [name]", "Hi [name]!", "Hello,"]

## Sign-offs
[List the most common closing lines found, e.g. "Thanks!", "Cheers,", "Best,", "Talk soon"]

## Email Structure
[Describe the typical order of an email, e.g. "Greeting → warm opener → main request → closing phrase → sign-off"]

## Common Phrases
[List 5–8 phrases or expressions that appear repeatedly across emails, and note WHERE they appear: opening / body / closing]

## Emoji Usage
[None / Rare / Occasional / Frequent] — [include examples if any, e.g. "👍, 🙏 used occasionally"]

## Style Notes
- [Observation 1 — e.g. "Gets straight to the point, minimal small talk"]
- [Observation 2 — e.g. "Uses bullet points for multi-item responses"]
- [Observation 3 — e.g. "Typically acknowledges the sender's last message before replying"]

STRICT RULES:
- Base analysis ONLY on the emails provided — do not invent patterns
- Use real examples quoted from the emails where possible
- If a section has no clear pattern write "Not enough data"
- Output ONLY the formatted style profile above — no preamble, no explanation
