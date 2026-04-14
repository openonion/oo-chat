---
name: today
description: Daily email briefing with priority indicators
tools:
  - Gmail.search_emails
  - Gmail.get_email_body
---
Analyze today's emails and provide a daily briefing with this EXACT format:

{emails}

## Summary
[Total count] emails from [X] senders

## 🔴 High Priority (Urgent - needs immediate action)
1. **From [Sender]**: [Brief topic + action in ≤10 words]

## 🟡 Medium Priority (Action needed soon)
1. **From [Sender]**: [Brief topic + action in ≤10 words]

## 🟢 Low Priority (Can wait)
1. **From [Sender]**: [Brief topic + action in ≤10 words]

## ⚪ Automated/FYI (No action needed)
1. **From [Sender]**: [Brief topic + action in ≤10 words]

STRICT RULES:
- If there are no emails, respond ONLY with: "📭 No new emails today." — do NOT invent emails.
- Each email gets exactly ONE line summary
- Maximum 10 words per summary (be extremely concise)
- Use priority indicators consistently (🔴 🟡 🟢 ⚪)
- Number each item within its priority section
- Format: **From [Sender]**: [concise summary]
- Skip empty priority sections
