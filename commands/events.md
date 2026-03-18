---
name: events
description: Extract events and meetings from recent emails and offer to create calendar entries
tools:
  - Gmail.search_emails
  - Gmail.get_email_body
  - GoogleCalendar.list_events
  - GoogleCalendar.create_event
  - GoogleCalendar.create_meet
  - Memory.write_memory
---
You have been given a list of recent emails that may contain events, meetings, or appointments:

{emails}

{% if existing_events %}
## Already in Calendar

These events are already on the calendar — do NOT suggest adding them again:

{existing_events}
{% endif %}

## Your Task

Extract all events from the emails and present them clearly. Then offer to create calendar entries.

### Step 1: Identify Events

For each email, ask: does this mention a specific date, time, or time reference (e.g. "next Monday", "3pm", "this Friday", "March 17th") that implies something is happening or due? If yes, treat it as an event regardless of what type it is.

Ignore dates that are clearly not actionable — for example:
- "Sent on March 1st" (email metadata)
- Newsletter or blog publication dates
- Historical references ("last year we...")
- Relative past references ("yesterday's meeting")

Use your own judgement. If a date or time reference implies something the user should show up for, act on, or be aware of, extract it.

{% if unconfirmed_only == "true" %}
**IMPORTANT**: Skip any event that already appears in the "Already in Calendar" section above.
{% endif %}

### Step 2: Extract Structured Details

For each event found, extract:
- **Title**: concise name (e.g., "Team Sync", "Project Deadline")
- **Date**: specific date in YYYY-MM-DD format if mentioned
- **Time**: start and end time if mentioned (use "TBD" if not specified)
- **Location**: physical address, Zoom/Meet link, or "TBD"
- **Attendees**: email addresses of participants
- **Source**: which email it came from (sender + subject)

Combine duplicate events — if the same meeting appears in multiple emails, show it once.

### Step 3: Save to Memory

Before presenting results, call `write_memory` with:
- **key**: `events:{today's date in YYYY-MM-DD}`
- **content**: a compact JSON-style list of extracted events, one per line:
  `[Title] | [Date] | [Time] | [Location] | [Attendees]`

### Step 4: Present Events

You MUST output every extracted event in full before asking for confirmation. Do not summarise or skip any. Use EXACTLY this format:

## 📅 Extracted Events

### 1. [Event Title]
- **Date**: [date or "Not specified"]
- **Time**: [start–end or "Not specified"]
- **Location**: [location or "Not specified"]
- **Attendees**: [comma-separated emails or "Not specified"]
- **From**: [Sender Name] — "[Email Subject]"

### 2. [Event Title]
- **Date**: ...
(continue for every event found)

---

**Found [N] event(s).**
1. [Title] on [Date]
2. [Title] on [Date]
(list all of them)

Should I add any of these to your calendar? You can say "add 1", "add 1,3", or "add all".

### Step 5: Create Calendar Entries

When the user confirms which events to add:
- Use `create_event` for regular events and deadlines
- Use `create_meet` for video meetings when no specific link is given
- If only a start time is known, default the duration to **1 hour**
- If date/time is missing entirely, ask ONLY for that before creating
- After creating, call `write_memory` to update the saved events list, appending " ✓" to the entries that were added

### STRICT RULES:
- If NO events are found, say: "No upcoming events or meetings found in the last {days} days of emails."
- Never invent details not present in the emails
- Never create calendar events without explicit user confirmation
- Prioritize events with specific dates over vague ones
