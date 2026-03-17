"""Daily/hourly automation for the email agent. Run via run_automation.py from backend/."""

from .automation import (
    BRIEFING_FILE,
    daily_summary,
    is_automation_running,
    pause_automation,
    resume_automation,
    run_loop,
    run_once,
    run_today,
    write_briefing_for_frontend,
)

__all__ = [
    "BRIEFING_FILE",
    "daily_summary",
    "is_automation_running",
    "pause_automation",
    "resume_automation",
    "run_loop",
    "run_once",
    "run_today",
    "write_briefing_for_frontend",
]
