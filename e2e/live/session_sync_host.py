from __future__ import annotations

import sys
import time
import uuid
from pathlib import Path

from connectonion import host


class _Tools:
    def names(self) -> list[str]:
        return []


class _LLM:
    model = "deterministic-e2e-echo"


class EchoAgent:
    name = "Session Sync E2E"
    system_prompt = "A deterministic agent used only for OIP session-sync acceptance."
    tools = _Tools()
    llm = _LLM()
    skills: list[object] = []

    def __init__(self) -> None:
        self.current_session: dict = {"messages": [], "trace": [], "turn": 0}

    def input(
        self,
        prompt: str,
        *,
        session: dict | None = None,
        images: object = None,
        files: object = None,
    ) -> str:
        del images, files
        current = dict(session or {})
        messages = list(current.get("messages") or [])
        result = f"E2E echo: {prompt}"
        now = time.time()
        messages.extend([
            {
                "role": "user",
                "content": prompt,
                "id": f"e2e-user-{uuid.uuid4()}",
                "created_at": now,
            },
            {
                "role": "assistant",
                "content": result,
                "id": f"e2e-agent-{uuid.uuid4()}",
                "created_at": now,
            },
        ])
        current.update({
            "messages": messages,
            "trace": list(current.get("trace") or []),
            "turn": int(current.get("turn") or 0) + 1,
        })
        self.current_session = current
        return result


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: session_sync_host.py <co-dir> <port>")
    host(
        EchoAgent,
        port=int(sys.argv[2]),
        trust="open",
        co_dir=Path(sys.argv[1]),
        summary="Deterministic OIP session-sync acceptance agent",
    )

