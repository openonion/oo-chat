"""
Core logic functions for Email Agent CLI.

These functions are shared by CLI commands and interactive slash commands.

Functions also used in automation.
"""

import json
import os
import re
import time
import uuid
from pathlib import Path

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


def _llm_complete(prompt: str) -> str:
    """Single LLM call — no agent loop, no plugins, no iterations."""
    response = agent.llm.complete([{"role": "user", "content": prompt}], tools=[])
    return response.content or ""


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


def get_email_provider_name() -> str:
    """Lowercase tool class name for automation payloads (gmail, outlook, none)."""
    email = _get_email_tool()
    if not email:
        return "none"
    return email.__class__.__name__.lower()


def _gmail_list_inbox_since(email, since_ts: float, max_results: int) -> list:
    from datetime import datetime

    service = email._get_service()
    window_start = max(since_ts, time.time() - 7 * 86400)
    date_s = datetime.fromtimestamp(window_start).strftime("%Y/%m/%d")
    query = f"in:inbox after:{date_s}"
    results = service.users().messages().list(
        userId="me", q=query, maxResults=min(max_results * 3, 100)
    ).execute()
    ids = [m["id"] for m in results.get("messages", [])]
    since_ms = int(since_ts * 1000)
    out = []
    for mid in ids:
        message = service.users().messages().get(
            userId="me",
            id=mid,
            format="metadata",
            metadataHeaders=["From", "Subject", "Date"],
        ).execute()
        internal_date = int(message.get("internalDate", 0))
        if internal_date < since_ms:
            continue
        headers = message["payload"]["headers"]
        subject = next((h["value"] for h in headers if h["name"] == "Subject"), "No Subject")
        from_email = next((h["value"] for h in headers if h["name"] == "From"), "Unknown")
        date = next((h["value"] for h in headers if h["name"] == "Date"), "Unknown")
        is_unread = "UNREAD" in message.get("labelIds", [])
        snippet = message.get("snippet", "")
        out.append({
            "id": mid,
            "from": from_email,
            "subject": subject,
            "date": date,
            "snippet": snippet,
            "unread": is_unread,
        })
        if len(out) >= max_results:
            break
    return out


def _outlook_list_inbox_since(email, since_ts: float, max_results: int) -> list:
    from datetime import datetime, timezone

    iso = datetime.fromtimestamp(since_ts, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    endpoint = "/me/mailFolders/inbox/messages"
    result = email._request(
        "GET",
        endpoint,
        params={
            "$filter": f"receivedDateTime ge {iso}",
            "$top": max_results,
            "$orderby": "receivedDateTime desc",
            "$select": "id,from,subject,receivedDateTime,bodyPreview,isRead",
        },
    )
    messages = result.get("value", [])
    out = []
    for msg in messages:
        from_obj = (msg.get("from") or {}).get("emailAddress", {}) or {}
        from_display = (
            f"{from_obj.get('name', '')} <{from_obj.get('address', '')}>"
            if from_obj.get("name")
            else (from_obj.get("address") or "Unknown")
        )
        out.append({
            "id": msg["id"],
            "from": from_display,
            "subject": msg.get("subject", "No Subject"),
            "date": msg.get("receivedDateTime", "Unknown"),
            "snippet": (msg.get("bodyPreview") or "")[:500],
            "unread": not msg.get("isRead", True),
        })
    return out


def list_inbox_messages_since(since_ts: float, max_results: int = 50) -> list:
    """
    Inbox messages received at or after since_ts (unix seconds).
    Uses Gmail internalDate or Outlook receivedDateTime for the watermark.
    """
    email = _get_email_tool()
    if not email:
        return []
    name = email.__class__.__name__
    if name == "Gmail":
        return _gmail_list_inbox_since(email, since_ts, max_results)
    if name == "Outlook":
        return _outlook_list_inbox_since(email, since_ts, max_results)
    return []


def _draft_original_email_fallback(src: dict) -> str:
    """Snippet-only when full body fetch is unavailable (From/Subject shown separately in UI)."""
    return src.get("snippet") or "(No body preview stored.)"


def _body_only_from_tool_email_text(full: str) -> str:
    """Strip Gmail/Outlook get_email_body() header; keep plain body after '--- Email Body ---'."""
    text = (full or "").strip()
    marker = "--- Email Body ---"
    if marker in text:
        return text.split(marker, 1)[1].strip()
    return text


def generate_reply_drafts(messages: list) -> list:
    """
    Ask the LLM which messages need replies and return structured drafts.
    Each item: draftId, messageId, subject, from, draftBody, originalEmail (body text only for UI).
    """
    if not messages:
        return []
    lines = []
    for i, m in enumerate(messages, 1):
        prev = (m.get("snippet") or "")[:200].replace("\n", " ")
        lines.append(
            f"{i}. messageId={m['id']} | from={m['from']} | subject={m['subject']} | preview={prev}"
        )
    block = "\n".join(lines)
    _style_path = Path(__file__).resolve().parent.parent / "data" / "writing_style.md"
    try:
        _style_text = _style_path.read_text(encoding="utf-8").strip()
    except OSError:
        _style_text = ""
    if _style_text:
        style_section = (
            "Follow this writing style profile when composing reply bodies (tone, greetings, sign-offs, "
            "structure, common phrases). If the thread clearly needs different formality, prioritize "
            "appropriateness to that message over the profile.\n\n"
            "--- User writing style profile ---\n"
            f"{_style_text}\n"
            "--- End profile ---\n\n"
        )
    else:
        style_section = (
            "No writing style profile is on file yet. Use a clear tone appropriate to each thread "
            "(professional by default unless the email is clearly casual).\n\n"
        )
    prompt = (
        "You are an email assistant. Below are emails the user received.\n"
        "For each email that clearly needs a personal reply (direct questions, requests, "
        "personal correspondence, actionable work mail), propose a concise draft reply.\n\n"
        f"{style_section}"
        "SKIP (do not include): newsletters, marketing, noreply/no-reply senders, automated receipts "
        "with no response needed, FYI digests, obvious bulk mail.\n\n"
        "Return ONLY a valid JSON array (no markdown code fences). Each object must have:\n"
        '- "messageId": string (exactly as given)\n'
        '- "subject": string (the email subject for UI)\n'
        '- "from": string (the From line for UI)\n'
        '- "draftBody": string (reply body only, plain text)\n\n'
        "If none need replies, return [].\n\nEmails:\n"
        f"{block}"
    )
    raw = _llm_complete(prompt).strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```\s*$", "", raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    out = []
    allowed_ids = {m["id"] for m in messages}
    by_id = {m["id"]: m for m in messages}
    for item in data:
        if not isinstance(item, dict):
            continue
        mid = item.get("messageId") or item.get("id")
        if mid not in allowed_ids:
            continue
        body = (item.get("draftBody") or "").strip()
        if not body:
            continue
        src = by_id.get(mid, {})
        out.append({
            "draftId": str(uuid.uuid4()),
            "messageId": mid,
            "subject": item.get("subject") or src.get("subject", ""),
            "from": item.get("from") or src.get("from", ""),
            "draftBody": body,
        })

    email = _get_email_tool()
    for d in out:
        mid = d["messageId"]
        src = by_id.get(mid, {})
        fallback = _draft_original_email_fallback(src)
        original = fallback
        if email and hasattr(email, "get_email_body"):
            try:
                fetched = email.get_email_body(mid)
                if fetched and str(fetched).strip():
                    original = _body_only_from_tool_email_text(str(fetched))
            except Exception:
                pass
        d["originalEmail"] = original

    return out


def refine_reply_draft(
    instruction: str,
    current_draft: str,
    *,
    subject: str = "",
    from_line: str = "",
    original_email: str = "",
) -> str:
    """
    Rewrite a reply draft per the user's instruction using the same LLM path as
    generate_reply_drafts (agent.llm via _llm_complete).
    Returns plain reply body text only.
    """
    inst = (instruction or "").strip()
    if not inst:
        return ""
    _style_path = Path(__file__).resolve().parent.parent / "data" / "writing_style.md"
    try:
        _style_text = _style_path.read_text(encoding="utf-8").strip()
    except OSError:
        _style_text = ""
    if _style_text:
        style_section = (
            "Follow this writing style profile (tone, greetings, sign-offs, structure, phrases). "
            "If the thread needs different formality, prioritize appropriateness over the profile.\n\n"
            "--- User writing style profile ---\n"
            f"{_style_text}\n"
            "--- End profile ---\n\n"
        )
    else:
        style_section = (
            "No writing style profile is on file yet. Use a clear tone appropriate to the thread.\n\n"
        )
    prompt = (
        "You are an email assistant revising a reply the user will send.\n"
        "Rewrite the draft to satisfy the user's instruction while staying appropriate for email.\n\n"
        f"{style_section}"
        "Output ONLY the revised reply body as plain text. No subject line, no greeting "
        "explanation, no markdown code fences, no preamble or postscript.\n\n"
        f"From (incoming): {from_line or '(unknown)'}\n"
        f"Subject: {subject or '(no subject)'}\n\n"
        f"Original message (context only):\n{(original_email or '').strip() or '(not available)'}\n\n"
        f"Current draft:\n{current_draft or '(empty)'}\n\n"
        f"User instruction: {inst}\n"
    )
    raw = _llm_complete(prompt).strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


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
    """Create calendar events for the given selection string ('add all', 'add 1', 'add 1,3', etc.)."""
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

def do_writing_style(count: int = 30) -> str:
    """Analyze sent emails and save writing style to data/writing_style.md."""
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."

    if not hasattr(email, 'get_sent_emails'):
        return "Sent email access not available for this provider."

    cmd = SlashCommand.load("writing_style")
    if not cmd:
        return "Command 'writing_style' not found in commands/"

    sent_emails = email.get_sent_emails(count)
    if not sent_emails:
        return "No sent emails found to analyze."

    prompt = cmd.prompt.replace("{emails}", sent_emails)
    style_content = _llm_complete(prompt)

    data_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')
    os.makedirs(data_dir, exist_ok=True)
    style_path = os.path.join(data_dir, 'writing_style.md')
    with open(style_path, 'w') as f:
        f.write(style_content)

    return (
        style_content
        + "\n\n---\n_Writing style profile saved to `data/writing_style.md`."
        " It will be used automatically when drafting emails._"
    )


def do_weekly_summary() -> str:
    """Run /weekly_summary command using SlashCommand."""
    from datetime import datetime, timedelta
    email = _get_email_tool()
    if not email:
        return "No email account connected. Use /link-gmail or /link-outlook to connect."

    cmd = SlashCommand.load("weekly_summary")
    if not cmd:
        return "Command 'weekly_summary' not found in commands/"

    today = datetime.now()
    seven_days_ago = today - timedelta(days=7)
    has_outlook = os.getenv("LINKED_OUTLOOK", "").lower() == "true"

    if has_outlook:
        date_from = seven_days_ago.strftime('%Y-%m-%d')
        date_to = today.strftime('%Y-%m-%d')
        query = f"received:{date_from}..{date_to}"
    else:
        query = "newer_than:7d"

    emails = email.search_emails(query=query, max_results=50)
    today_str = today.strftime('%Y-%m-%d')
    prompt = cmd.prompt.replace("{emails}", emails).replace("{date}", today_str)
    return agent.input(prompt)

def do_ask(question: str) -> str:
    return agent.input(question)


class CommandRouter:
    """Wraps the agent so slash commands are handled directly without going through the LLM.

    When a message starts with a known slash command (e.g. /today, /events 7),
    the corresponding do_* function is called immediately and its result returned.
    All other messages are forwarded to the underlying agent unchanged.

    Also proxies all attribute access to the underlying agent so ConnectOnion's
    host() infrastructure (which reads .name, .tools, .llm, .current_session, etc.)
    works transparently.
    """

    def __init__(self, wrapped_agent):
        # Store under mangled name to avoid interfering with __getattr__
        object.__setattr__(self, '_agent', wrapped_agent)
        # Pending events from the last /events call, waiting for "add X" confirmation
        object.__setattr__(self, '_pending_events', None)

    @staticmethod
    def _is_add_reply(text: str) -> bool:
        """Return True if the message looks like an "add X" reply to /events."""
        import re
        t = text.lower().strip()
        return bool(re.match(r'^add\b', t))

    def input(self, prompt: str, **kwargs):
        import re
        text = prompt.strip()

        # --- "add 1", "add 1,3", "add all" — follow-up to /events ---
        pending = object.__getattribute__(self, '_pending_events')
        if pending is not None and self._is_add_reply(text):
            object.__setattr__(self, '_pending_events', None)
            return do_create_events(pending, text)

        # --- /today ---
        if text == '/today':
            return do_today()

        # --- /weekly_summary ---
        if text == '/weekly_summary':
            return do_weekly_summary()

        # --- /events [N] [--unconfirmed|-u] ---
        if text == '/events' or text.startswith('/events '):
            parts = text.split()
            days = next((int(p) for p in parts[1:] if p.isdigit()), 7)
            unconfirmed = '--unconfirmed' in parts or '-u' in parts
            display_text, events = do_events(days=days, unconfirmed=unconfirmed)
            object.__setattr__(self, '_pending_events', events if events else None)
            return display_text

        # --- /inbox [N] ---
        if text == '/inbox' or text.startswith('/inbox '):
            parts = text.split()
            count = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 10
            return do_inbox(count=count)

        # --- /search <query> ---
        if text.startswith('/search '):
            query = text[len('/search '):].strip()
            return do_search(query=query) if query else "Usage: /search <query>"

        # --- /contacts ---
        if text == '/contacts':
            return do_contacts()

        # --- /sync ---
        if text == '/sync':
            return do_sync()

        # --- /init ---
        if text == '/init':
            return do_init()

        # --- /unanswered ---
        if text == '/unanswered':
            return do_unanswered()

        # --- /identity ---
        if text == '/identity':
            return do_identity()

        # --- /writing_style [N] ---
        if text == '/writing_style' or text.startswith('/writing_style '):
            parts = text.split()
            count = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 30
            return do_writing_style(count=count)

        # Not a slash command — pass through to the LLM agent
        wrapped = object.__getattribute__(self, '_agent')
        return wrapped.input(prompt, **kwargs)

    def __getattr__(self, name):
        wrapped = object.__getattribute__(self, '_agent')
        return getattr(wrapped, name)

    def __setattr__(self, name, value):
        if name in ('_agent', '_pending_events'):
            object.__setattr__(self, name, value)
        else:
            setattr(object.__getattribute__(self, '_agent'), name, value)


def do_host(port: int = 8000, trust: str = "careful"):
    """Start the agent as an HTTP/WebSocket server."""
    from connectonion import host
    router = CommandRouter(agent)
    host(lambda: router, port=port, trust=trust)
