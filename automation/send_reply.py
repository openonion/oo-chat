#!/usr/bin/env python3
"""
Send a reply for one message (stdin JSON). Used by oo-chat when no HTTP briefing server.

Example:
  echo '{"messageId":"abc","body":"Thanks!"}' | python automation/send_reply.py

Run from capstone-project-26t1-3900-w18a-date root with env configured like the main agent.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def perform_send(message_id: str, body: str) -> dict:
    """Send reply via configured Gmail/Outlook tool. Returns {ok, message?|error?}."""
    root = Path(__file__).resolve().parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from cli.core import _get_email_tool

    email = _get_email_tool()
    if not email:
        return {"ok": False, "error": "No email account connected"}
    if not hasattr(email, "reply"):
        return {"ok": False, "error": "Reply not supported for this provider"}
    try:
        result = email.reply(str(message_id), str(body))
    except Exception as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "message": result}


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    raw = sys.stdin.read()
    if not raw.strip():
        print(json.dumps({"ok": False, "error": "empty stdin"}))
        return 1
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"invalid json: {e}"}))
        return 1
    mid = data.get("messageId")
    body = data.get("body")
    draft_id = data.get("draftId")
    if not mid or body is None:
        print(json.dumps({"ok": False, "error": "messageId and body required"}))
        return 1
    out = perform_send(str(mid), str(body))
    if out.get("ok"):
        try:
            from automation.automation import remove_draft_from_briefing

            remove_draft_from_briefing(str(mid), str(draft_id) if draft_id else None)
        except Exception:
            pass
    print(json.dumps(out))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
