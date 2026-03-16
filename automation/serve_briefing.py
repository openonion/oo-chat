#!/usr/bin/env python3
"""
Optional HTTP server that serves the latest automation briefing for the frontend.

Run when oo-chat and the backend are on different hosts so the frontend can
fetch GET /briefing via BACKEND_BRIEFING_URL.

  python serve_briefing.py [--port 8001]

Serves GET /briefing -> JSON { lastRunAt, briefing, summary } from
data/automation_briefing.json (or 404 if file missing).
"""

import argparse
import json
from pathlib import Path

from automation import BRIEFING_FILE

try:
    from starlette.applications import Starlette
    from starlette.responses import JSONResponse, Response
    from starlette.routing import Route
except ImportError:
    print("Install starlette and uvicorn: pip install starlette uvicorn")
    raise


async def briefing(_request):
    if not BRIEFING_FILE.exists():
        return Response(status_code=404, content=b"{}")
    data = json.loads(BRIEFING_FILE.read_text(encoding="utf-8"))
    return JSONResponse(data)


app = Starlette(
    routes=[Route("/briefing", briefing)],
)


def main():
    parser = argparse.ArgumentParser(description="Serve GET /briefing for oo-chat")
    parser.add_argument("--port", type=int, default=8001, help="Port to listen on")
    args = parser.parse_args()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()
