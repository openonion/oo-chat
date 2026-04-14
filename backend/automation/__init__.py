"""Daily/hourly automation for the email agent. Run via run_automation.py from backend/."""

from .automation import (
    briefing_file_path,
    daily_summary,
    is_automation_running,
    pause_automation,
    resume_automation,
    run_loop,
    run_once,
    write_briefing_for_frontend,
)

__all__ = [
    "briefing_file_path",
    "daily_summary",
    "is_automation_running",
    "pause_automation",
    "resume_automation",
    "run_loop",
    "run_once",
    "write_briefing_for_frontend",
]
