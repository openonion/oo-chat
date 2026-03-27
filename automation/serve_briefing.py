#!/usr/bin/env python3
"""
Optional HTTP server that serves the latest automation briefing for the frontend.

Run when oo-chat and the backend are on different hosts so the frontend can
fetch GET /briefing via BACKEND_BRIEFING_URL.

  python serve_briefing.py [--port 8001]

Serves:
  GET  /briefing -> JSON payload from data/automation_briefing.json (or 404 if missing).
  POST /reply         -> JSON { "messageId", "body", "draftId"? } sends reply and removes that draft from briefing JSON.
  POST /discard-draft -> JSON { "draftId", "messageId"? } removes a draft without sending.
"""

import argparse
import json
from pathlib import Path

from automation import briefing_file_path

try:
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route
except ImportError:
    print("Install starlette and uvicorn: pip install starlette uvicorn")
    raise


async def briefing(_request):
    path = briefing_file_path()
    if not path.exists():
        return Response(status_code=404, content=b"{}")
    data = json.loads(path.read_text(encoding="utf-8"))
    return JSONResponse(data)


async def reply(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Invalid JSON body"}, status_code=400)
    mid = data.get("messageId")
    body = data.get("body")
    draft_id = data.get("draftId")
    if not mid or body is None:
        return JSONResponse({"ok": False, "error": "messageId and body required"}, status_code=400)
    from automation.send_reply import perform_send
    from automation.automation import remove_draft_from_briefing

    out = perform_send(str(mid), str(body))
    if out.get("ok"):
        try:
            remove_draft_from_briefing(str(mid), str(draft_id) if draft_id else None)
        except Exception:
            pass
    status = 200 if out.get("ok") else 502
    return JSONResponse(out, status_code=status)


async def discard_draft(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"ok": False, "error": "Invalid JSON body"}, status_code=400)
    did = data.get("draftId")
    mid = data.get("messageId") or ""
    if not did:
        return JSONResponse({"ok": False, "error": "draftId required"}, status_code=400)
    from automation.automation import remove_draft_from_briefing

    ok = remove_draft_from_briefing(str(mid), str(did))
    if not ok:
        return JSONResponse({"ok": False, "error": "Draft not found"}, status_code=404)
    return JSONResponse({"ok": True})


app = Starlette(
    routes=[
        Route("/briefing", briefing),
        Route("/reply", reply, methods=["POST"]),
        Route("/discard-draft", discard_draft, methods=["POST"]),
    ],
)


def main():
    parser = argparse.ArgumentParser(description="Serve GET /briefing and POST /reply for oo-chat")
    parser.add_argument("--port", type=int, default=8001, help="Port to listen on")
    args = parser.parse_args()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
