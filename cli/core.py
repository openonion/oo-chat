"""
Core logic functions for Email Agent CLI.

These functions are shared by CLI commands and interactive slash commands.
"""

from connectonion import SlashCommand
from agent import agent


def _get_email_tool():
    """Get the first configured email tool (Gmail or Outlook)."""
    # Access via agent's tool registry
    if hasattr(agent.tools, 'gmail'):
        return agent.tools.gmail
    if hasattr(agent.tools, 'outlook'):
        return agent.tools.outlook
    return None


def do_inbox(count: int = 10, unread: bool = False) -> str:
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."
    return email.read_inbox(last=count, unread=unread)


def do_search(query: str, count: int = 10) -> str:
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."
    return email.search_emails(query=query, max_results=count)


def do_contacts() -> str:
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."
    # Gmail has get_cached_contacts, Outlook may not
    if hasattr(email, 'get_cached_contacts'):
        return email.get_cached_contacts()
    return "Contact caching not available for this provider."


def do_sync(max_emails: int = 500, exclude: str = "openonion.ai,connectonion.com") -> str:
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."
    if hasattr(email, 'sync_contacts'):
        return email.sync_contacts(max_emails=max_emails, exclude_domains=exclude)
    return "Contact syncing not available for this provider."


def do_init(max_emails: int = 500, top_n: int = 10, exclude: str = "openonion.ai,connectonion.com") -> str:
    from agent import init_crm_database
    return init_crm_database(max_emails=max_emails, top_n=top_n, exclude_domains=exclude)


def do_unanswered(days: int = 120, count: int = 20) -> str:
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."
    if hasattr(email, 'get_unanswered_emails'):
        return email.get_unanswered_emails(within_days=days, max_results=count)
    return "Unanswered email tracking not available for this provider."


def do_identity(detect: bool = False) -> str:
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."
    if detect and hasattr(email, 'detect_all_my_emails'):
        return email.detect_all_my_emails(max_emails=100)
    if hasattr(email, 'get_my_identity'):
        return email.get_my_identity()
    if hasattr(email, 'get_my_email'):
        return email.get_my_email()
    return "Identity detection not available for this provider."


def do_today() -> str:
    """Run /today command using SlashCommand."""
    from datetime import datetime, timedelta
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."

    cmd = SlashCommand.load("today")
    if not cmd:
        return "Command 'today' not found in commands/"

    # Get today's emails
    yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y/%m/%d')
    emails = email.search_emails(query=f"after:{yesterday}", max_results=50)

    # Replace {emails} placeholder in prompt
    prompt = cmd.prompt.replace("{emails}", emails)
    return _llm_complete(prompt)


def _llm_complete(prompt: str) -> str:
    """Single LLM call — no agent loop, no plugins, no iterations."""
    response = agent.llm.complete([{"role": "user", "content": prompt}], tools=[])
    return response.content or ""


def _get_calendar_tool():
    """Get the first configured calendar tool (Google or Microsoft)."""
    if hasattr(agent.tools, 'googlecalendar'):
        return agent.tools.googlecalendar
    if hasattr(agent.tools, 'microsoftcalendar'):
        return agent.tools.microsoftcalendar
    return None


def do_events(days: int = 7, unconfirmed: bool = False) -> tuple:
    """Extract events from recent emails.

    Returns (display_text, events_list).
    display_text includes the formatted list and a single confirmation prompt.
    events_list is the raw list of event dicts for use by do_create_events().
    """
    import json
    from datetime import datetime as dt, timedelta
    from zoneinfo import ZoneInfo
    aedt = ZoneInfo("Australia/Sydney")
    email = _get_email_tool()
    if not email:
        msg = "No email account connected. Use /link-gmail or /link-outlook to connect."
        return msg, []

    since = (dt.now(tz=aedt) - timedelta(days=days)).strftime('%Y/%m/%d')
    query = (
        f"after:{since} ("
        "\"/2025\" OR \"/2026\" OR \"/2027\" OR "
        "\"-01-\" OR \"-02-\" OR \"-03-\" OR \"-04-\" OR \"-05-\" OR \"-06-\" OR "
        "\"-07-\" OR \"-08-\" OR \"-09-\" OR \"-10-\" OR \"-11-\" OR \"-12-\" OR "
        "\"am\" OR \"pm\" OR \"o'clock\" OR "
        "Monday OR Tuesday OR Wednesday OR Thursday OR Friday OR Saturday OR Sunday OR "
        "January OR February OR March OR April OR May OR June OR "
        "July OR August OR September OR October OR November OR December OR "
        "tonight OR tomorrow OR \"next week\" OR \"this week\""
        ")"
    )
    emails_text = email.search_emails(query=query, max_results=50) or "No emails found."

    existing_events = ""
    if unconfirmed:
        cal = _get_calendar_tool()
        if cal:
            existing_events = cal.list_events(days_ahead=days) or ""

    today = dt.now(tz=aedt).strftime('%Y-%m-%d')
    existing_block = f"\nAlready on calendar (skip these):\n{existing_events}\n" if existing_events else ""

    extraction_prompt = f"""Extract all upcoming events/meetings from these emails. Today is {today}.

{emails_text}
{existing_block}
Return ONLY a JSON array (no markdown, no explanation). Each element:
{{
  "title": "event name",
  "date": "YYYY-MM-DD or null",
  "start_time": "HH:MM (24h) or null",
  "end_time": "HH:MM (24h) or null",
  "location": "address, Zoom/Meet link, or null",
  "attendees": "comma-separated emails or null",
  "is_video_call": true or false
}}

Rules:
- Skip past events (before {today}), newsletter dates, sent/received metadata
- is_video_call = true when Zoom/Meet/Teams link or "video call" is mentioned
- If no events found return []"""

    raw = _llm_complete(extraction_prompt).strip()
    if raw.startswith("```"):
        raw = raw[raw.index("\n") + 1:] if "\n" in raw else raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3].strip()

    try:
        events = json.loads(raw)
    except json.JSONDecodeError:
        return f"Could not parse events from emails.\n\n{raw}", []

    if not events:
        return f"No upcoming events found in the last {days} days of emails.", []

    lines = ["## 📅 Extracted Events\n"]
    for i, ev in enumerate(events, 1):
        lines.append(f"### {i}. {ev.get('title', 'Untitled')}")
        lines.append(f"- **Date**: {ev.get('date') or 'Not specified'}")
        lines.append(f"- **Time**: {ev.get('start_time') or 'TBD'}–{ev.get('end_time') or 'TBD'}")
        lines.append(f"- **Location**: {ev.get('location') or 'Not specified'}")
        lines.append(f"- **Attendees**: {ev.get('attendees') or 'Not specified'}")
        lines.append("")
    lines.append(f"---\n\n**Found {len(events)} event(s).**")
    for i, ev in enumerate(events, 1):
        lines.append(f"{i}. {ev.get('title', 'Untitled')} on {ev.get('date') or 'date unknown'}")
    lines.append('\nShould I add any of these to your calendar? You can say "add 1", "add 1,3", or "add all".')

    return "\n".join(lines), events


def do_create_events(events: list, selection: str) -> str:
    """Create calendar events for the given selection ('add all', 'add 1', 'add 1,3', etc.)."""
    import re
    from datetime import datetime as dt, timedelta

    cal = _get_calendar_tool()
    if not cal:
        return "No calendar connected — cannot create events."

    sel = selection.lower().strip()
    if "all" in sel:
        selected = list(enumerate(events))
    else:
        nums = [int(n) - 1 for n in re.findall(r'\d+', sel)]
        selected = [(i, events[i]) for i in nums if 0 <= i < len(events)]

    if not selected:
        return "No events matched your selection."

    added, skipped = [], []
    for _, ev in selected:
        title = ev.get("title") or "Untitled Event"
        date = ev.get("date")
        start_t = ev.get("start_time")
        end_t = ev.get("end_time")
        location = ev.get("location") or None
        attendees = ev.get("attendees") or None
        is_video = bool(ev.get("is_video_call"))

        if not date or not start_t:
            skipped.append(f"{title} (no date/time)")
            continue

        start_str = f"{date} {start_t}"
        if end_t:
            end_str = f"{date} {end_t}"
        else:
            end_dt = dt.strptime(start_str, "%Y-%m-%d %H:%M") + timedelta(hours=1)
            end_str = end_dt.strftime("%Y-%m-%d %H:%M")

        try:
            if is_video and attendees:
                cal.create_meet(title=title, start_time=start_str, end_time=end_str,
                                attendees=attendees,
                                description=f"Location: {location}" if location else None)
            else:
                cal.create_event(title=title, start_time=start_str, end_time=end_str,
                                 location=location, attendees=attendees)
            added.append(f"✅ **{title}** — {date} at {start_t}")
        except Exception as e:
            skipped.append(f"{title} (error: {e})")

    lines = ["## ✅ Added to Calendar\n"] + added
    if skipped:
        lines += ["\n### Skipped:"] + [f"- {s}" for s in skipped]
    if not added:
        return f"No events could be added ({len(skipped)} skipped — missing date/time)."
    return "\n".join(lines)


def do_ask(question: str) -> str:
    return agent.input(question)


def do_host(port: int = 8000, trust: str = "careful"):
    """Start the agent as an HTTP/WebSocket server."""
    from connectonion import host
    host(agent, port=port, trust=trust)
