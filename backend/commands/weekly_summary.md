---
name: weekly_summary
description: Weekly email summary with stats and categories
tools:
  - search_emails
  - get_email_body
---
Analyze the past 7 days of emails (week ending {date}) and provide a summary using ONLY the emails below. Do NOT fetch more emails.

{emails}

Respond in this EXACT format — ALL sections are required, even if counts are 0:

## 📬 Weekly Summary — {date}

**Stats:** [total] emails · [X] need replies · [X] urgent · [X] meetings

## 🔴 Action Required
[List urgent emails needing immediate reply, or write "None this week"]

## 🟡 Follow-ups
[List emails needing a reply soon, or write "None this week"]

## 📅 Meetings & Events
[List any scheduling requests or events, or write "None this week"]

## 📊 By Category
- Work / projects: X emails
- Meeting requests: X emails
- Newsletters / promos: X emails
- Other: X emails

## 👤 Top Senders
1. [Name or email]: X emails

STRICT RULES:
- Each item gets exactly ONE line, max 12 words
- ALL 6 sections must appear in the output — never skip a section
- For empty sections write "[category]: None this week" not skip the section
- Do not invent data not present in the emails above