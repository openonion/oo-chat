#!/usr/bin/env python3
"""
Revise a reply draft from natural-language instructions (stdin JSON).

Used by oo-chat when no HTTP briefing server, same pattern as send_reply.py.

Example:
  echo '{"instruction":"shorter","currentDraft":"Hi...","draftId":"uuid","messageId":"mid"}' \\
    | python automation/refine_draft.py

Optional draftId / messageId: when present, the refined body is written to automation_briefing.json.

Run from capstone-project-26t1-3900-w18a-date root with .env configured like the main agent.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


def perform_refine(
    instruction: str,
    current_draft: str,
    *,
    subject: str = "",
    from_line: str = "",
    original_email: str = "",
) -> dict:
    """Returns {ok, draftBody?} or {ok: False, error}."""
    root = Path(__file__).resolve().parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from cli.core import refine_reply_draft

    try:
        body = refine_reply_draft(
            instruction,
            current_draft,
            subject=subject,
            from_line=from_line,
            original_email=original_email,
        )
    except Exception as e:
        return {"ok": False, "error": str(e)}
    if not body:
        return {"ok": False, "error": "Empty revision from model"}
    return {"ok": True, "draftBody": body}


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

    instruction = data.get("instruction")
    current_draft = data.get("currentDraft")
    if current_draft is None:
        current_draft = ""
    if not instruction or not str(instruction).strip():
        print(json.dumps({"ok": False, "error": "instruction required"}))
        return 1

    out = perform_refine(
        str(instruction).strip(),
        str(current_draft),
        subject=str(data.get("subject") or ""),
        from_line=str(data.get("from") or ""),
        original_email=str(data.get("originalEmail") or ""),
    )
    if out.get("ok") and out.get("draftBody") is not None:
        try:
            from automation.automation import update_draft_body_in_briefing

            did = data.get("draftId")
            mid = data.get("messageId")
            update_draft_body_in_briefing(
                str(out["draftBody"]),
                draft_id=str(did) if did else None,
                message_id=str(mid) if mid else None,
            )
        except Exception:
            pass
    print(json.dumps(out))
    return 0 if out.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
