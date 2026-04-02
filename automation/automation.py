"""
Daily/hourly automation for Email Agent.

Runs the same logic as /today on a schedule, plus a daily summary (counts).
Pause/resume via config file.
Writes results to data/automation_briefing.json so the frontend (oo-chat) can show them.

Config file: automation_config.json (written by Settings UI).
"""

import os
import re
import json
import logging
import time
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# File written by automation for frontend to read (relative to backend dir)
BRIEFING_FILE = Path(__file__).resolve().parent / "data" / "automation_briefing.json"


def is_automation_running() -> bool:
    """True if config file says automation is running."""
    config_path = Path(__file__).resolve().parent / "automation_config.json"
    if config_path.exists():
        try:
            data = json.loads(config_path.read_text())
            if "running" in data:
                return data["running"] is True
        except Exception as e:
            logger.warning("Could not read automation_config.json: %s", e)
    return False


def run_today() -> str:
    """Run the same logic as /today. Uses cli.core.do_today()."""
    from cli.core import do_today
    return do_today()


def refresh_writing_style() -> None:
    """
    Silently regenerate data/writing_style.md from the user's sent emails.
    Only runs once per day — skipped if the file was written in the last 23 hours.
    """
    from cli.core import do_writing_style

    style_path = Path(__file__).resolve().parent.parent / "data" / "writing_style.md"
    if style_path.exists():
        age_hours = (time.time() - style_path.stat().st_mtime) / 3600
        if age_hours < 23:
            logger.debug("Writing style profile is fresh (%.1fh old), skipping refresh", age_hours)
            return

    logger.info("Refreshing writing style profile from sent emails...")
    try:
        do_writing_style()
        logger.info("Writing style profile updated at %s", style_path)
    except Exception as e:
        logger.warning("Could not refresh writing style profile: %s", e)


def daily_summary(today_output: str) -> str:
    """
    Daily summary: counts derived from today's briefing.
    Returns a short summary line (processed/drafted/scheduled can be extended later).
    """
    text = (today_output or "").strip()
    lines = text.splitlines()
    total = 0
    high = medium = low = automated = 0
    section = None
    for line in lines:
        if "## Summary" in line or "emails from" in line:
            m = re.search(r"(\d+)\s*emails", line, re.I)
            if m:
                total = int(m.group(1))
        if "🔴" in line and "High Priority" in line:
            section = "high"
        elif "🟡" in line and "Medium Priority" in line:
            section = "medium"
        elif "🟢" in line and "Low Priority" in line:
            section = "low"
        elif "⚪" in line and "Automated/FYI" in line:
            section = "automated"
        elif section and re.match(r"^\s*\d+\.\s+\*\*", line):
            if section == "high":
                high += 1
            elif section == "medium":
                medium += 1
            elif section == "low":
                low += 1
            elif section == "automated":
                automated += 1
    if total == 0:
        total = high + medium + low + automated
    processed = total
    drafted = 0 # TODO: automate drafting
    scheduled = 0 # TODO: automate scheduling
    return (
        f"Summary: {total} emails in briefing "
        f"({high} high, {medium} medium, {low} low, {automated} automated); "
        f"processed={processed}, drafted={drafted}, scheduled={scheduled}"
    )


def write_briefing_for_frontend(briefing: str, summary: str) -> None:
    """Write briefing and summary to data/automation_briefing.json for oo-chat to display."""
    BRIEFING_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "lastRunAt": time.time(),
        "briefing": briefing or "",
        "summary": summary or "",
    }
    BRIEFING_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    logger.debug("Wrote briefing to %s", BRIEFING_FILE)


def pause_automation():
    """Pause the automation by writing to the automation_config.json file."""
    try:
        with open("automation/automation_config.json", "r") as f:
            config = json.load(f)
    except FileNotFoundError:
        config = {}
    config["running"] = False
    with open("automation/automation_config.json", "w") as f:
        json.dump(config, f, indent=4)
    logger.info("Automation paused")
    return "Automation paused"


def resume_automation():
    """Resume the automation by writing to the automation_config.json file."""
    try:
        with open("automation/automation_config.json", "r") as f:
            config = json.load(f)
    except FileNotFoundError:
        config = {}
    config["running"] = True
    with open("automation/automation_config.json", "w") as f:
        json.dump(config, f, indent=4)
    logger.info("Automation resumed")
    return "Automation resumed"


def run_once() -> bool:
    """
    Run today's logic once plus daily summary. Respects running status.
    Writes result to data/automation_briefing.json so the frontend can show it.
    Returns True if a run was performed, False if skipped.
    """
    if not is_automation_running():
        logger.info("Automation skipped: automation not running")
        return False
    try:
        refresh_writing_style()
        today_result = run_today()
        logger.info("Today run completed (%d chars)", len(today_result or ""))
        summary = daily_summary(today_result)
        logger.info("Summary: %s", summary)
        write_briefing_for_frontend(today_result, summary)
        return True
    except Exception as e:
        logger.exception("Automation run failed: %s", e)
        raise


def run_loop(interval_seconds: int = 3600) -> None:
    """Run today + daily summary every interval_seconds (e.g. 3600 = hourly)."""
    import time
    logger.info("Automation loop started (interval=%ds)", interval_seconds)
    while True:
        run_once()
        time.sleep(interval_seconds)
