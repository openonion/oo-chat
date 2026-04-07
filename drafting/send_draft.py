"""
Send a new email via configured Gmail/Outlook tool.
Reads JSON from stdin: {to, subject, body, cc?, bcc?}
Outputs JSON to stdout: {ok: true, message: "..."} or {ok: false, error: "..."}
"""
import json
import sys
from pathlib import Path

def perform_send_draft(to: str, subject: str, body: str, cc: str = None, bcc: str = None) -> dict:
    """Send a new email via configured Gmail/Outlook tool. Returns {ok, message?|error?}."""
    root = Path(__file__).resolve().parent.parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    from cli.core import _get_email_tool

    email = _get_email_tool()
    if not email:
        return {"ok": False, "error": "No email account connected"}
    if not hasattr(email, "send"):
        return {"ok": False, "error": "Send not supported for this provider"}
    try:
        result = email.send(
            to=to,
            subject=subject,
            body=body,
            cc=cc,
            bcc=bcc,
        )
    except Exception as e:
        return {"ok": False, "error": str(e)}
    return {"ok": True, "message": result}


if __name__ == "__main__":
    try:
        data = json.loads(sys.stdin.read())
        to = data.get("to", "")
        subject = data.get("subject", "")
        body = data.get("body", "")
        cc = data.get("cc") or None
        bcc = data.get("bcc") or None

        if not to or not subject or not body:
            print(json.dumps({"ok": False, "error": "to, subject, and body are required"}))
            sys.exit(0)

        result = perform_send_draft(to, subject, body, cc, bcc)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))