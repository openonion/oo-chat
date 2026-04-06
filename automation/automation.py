"""
Daily/hourly automation for Email Agent.

Scans inbox for messages received since the last successful run (watermark in
automation_config.json as lastScannedAt). If missing, uses the last 24 hours.
Briefing text is from do_today() (same as /today: last ~24h search). Reply drafts
use the watermark slice from list_inbox_messages_since.
Pause/resume via config file.

Writes results to data/automation_briefing.json so the frontend (oo-chat) can show them.

Config file: automation_config.json (written by Settings UI + automation).
Unsent reply drafts persist in automation_briefing.json across runs until the user sends them.
"""

import json
import logging
import re
import time
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DEFAULT_SCAN_LOOKBACK_SEC = 24 * 3600


def _package_dir() -> Path:
    """Automation package directory (resolves at call time so tests can patch __file__)."""
    return Path(__file__).resolve().parent


def config_file_path() -> Path:
    return _package_dir() / "automation_config.json"


def briefing_file_path() -> Path:
    """JSON file consumed by oo-chat briefing UI."""
    return _package_dir() / "data" / "automation_briefing.json"


def read_automation_config() -> dict[str, Any]:
    """Full config dict; missing file -> {}."""
    cfg_path = config_file_path()
    if not cfg_path.exists():
        return {}
    try:
        return json.loads(cfg_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning("Could not read automation_config.json: %s", e)
        return {}


def write_automation_config(data: dict[str, Any]) -> None:
    cfg_path = config_file_path()
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    cfg_path.write_text(json.dumps(data, indent=2), encoding="utf-8")


def is_automation_running() -> bool:
    """True if config file says automation is running."""
    cfg = read_automation_config()
    return cfg.get("running", False)


def get_last_scanned_at() -> Optional[float]:
    """Unix time watermark for the next inbox scan, or None if never set."""
    cfg = read_automation_config()
    v = cfg.get("lastScannedAt")
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def set_last_scanned_at(ts: float) -> None:
    cfg = read_automation_config()
    cfg["lastScannedAt"] = ts
    write_automation_config(cfg)


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


def daily_summary(today_output: str, draft_count: int = 0) -> str:
    """
    Daily summary: counts derived from today's briefing plus draft count.
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
    drafted = draft_count
    scheduled = 0  # reserved
    return (f"{processed} emails processed during scan, {drafted} drafts to review, {scheduled} scheduled")


def write_briefing_for_frontend(
    briefing: str,
    summary: str,
    *,
    drafts: list[dict[str, Any]],
    provider: str,
    scanSince: float,
    scanUntil: float,
    messagesSeen: int,
) -> None:
    """Write automation payload for oo-chat (briefing + interactive reply drafts)."""
    out_path = briefing_file_path()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    b = briefing or ""
    payload = {
        "scanSince": scanSince,
        "scanUntil": scanUntil,
        "provider": provider,
        "messagesSeen": messagesSeen,
        "briefingSections": briefing_sections_from_markdown(b),
        "summary": summary or "",
        "drafts": drafts,
    }
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    logger.debug("Wrote briefing to %s", out_path)


def load_persisted_drafts() -> list[dict[str, Any]]:
    """Drafts from the last briefing file (still waiting to be sent)."""
    path = briefing_file_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        raw = data.get("drafts") or []
        return [d for d in raw if isinstance(d, dict) and d.get("messageId")]
    except Exception as e:
        logger.warning("Could not load persisted drafts: %s", e)
        return []


def merge_drafts_persist(
    previous: list[dict[str, Any]], fresh: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """
    Keep prior drafts the user has not sent; add LLM drafts only for message IDs
    not already present (preserves in-progress edits).
    """
    seen = {d["messageId"] for d in previous if d.get("messageId")}
    out = [dict(d) for d in previous]
    for d in fresh:
        mid = d.get("messageId")
        if not mid or mid in seen:
            continue
        out.append(dict(d))
        seen.add(mid)
    return out


def remove_draft_from_briefing(message_id: str, draft_id: Optional[str] = None) -> bool:
    """
    Remove one draft after a successful send. Prefer draft_id when provided so
    multiple rows for the same message are not all dropped.
    """
    path = briefing_file_path()
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    drafts = data.get("drafts") or []
    if not isinstance(drafts, list):
        return False
    new_drafts: list[Any] = []
    removed = False
    for d in drafts:
        if not isinstance(d, dict):
            new_drafts.append(d)
            continue
        if draft_id:
            if d.get("draftId") == draft_id:
                removed = True
                continue
        else:
            if d.get("messageId") == message_id:
                removed = True
                continue
        new_drafts.append(d)
    if not removed:
        return False
    data["drafts"] = new_drafts
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    logger.debug("Removed draft from briefing after send (message_id=%s draft_id=%s)", message_id, draft_id)
    return True


def update_draft_body_in_briefing(
    new_body: str,
    *,
    draft_id: Optional[str] = None,
    message_id: Optional[str] = None,
) -> bool:
    """
    Persist an edited/refined reply body into automation_briefing.json.
    Prefer draft_id when set; otherwise update the first draft row matching message_id.
    """
    if not (draft_id or message_id):
        return False
    path = briefing_file_path()
    if not path.exists():
        return False
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    drafts = data.get("drafts") or []
    if not isinstance(drafts, list):
        return False
    updated = False
    for d in drafts:
        if not isinstance(d, dict):
            continue
        if draft_id:
            if d.get("draftId") == draft_id:
                d["draftBody"] = str(new_body)
                updated = True
                break
        elif message_id and d.get("messageId") == message_id:
            d["draftBody"] = str(new_body)
            updated = True
            break
    if not updated:
        return False
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    logger.debug(
        "Updated draft body in briefing (draft_id=%s message_id=%s)",
        draft_id,
        message_id,
    )
    return True


def pause_automation():
    """Pause the automation by writing to the automation_config.json file."""
    config = read_automation_config()
    config["running"] = False
    write_automation_config(config)
    logger.info("Automation paused")
    return "Automation paused"


def resume_automation():
    """Resume the automation by writing to the automation_config.json file."""
    config = read_automation_config()
    config["running"] = True
    write_automation_config(config)
    logger.info("Automation resumed")
    return "Automation resumed"


def _trim_briefing_for_frontend(briefing: str) -> str:
    """Strip {emails} block from today command output; starts at ## Summary."""
    if not briefing:
        return ""
    s = briefing.strip()
    marker = "## Summary"
    idx = s.find(marker)
    if idx <= 0:
        return s
    return s[idx:].strip()


_HEADING_LINE = re.compile(r"^##\s+(.+)$", re.MULTILINE)


def briefing_sections_from_markdown(briefing: str) -> list[dict[str, str]]:
    """
    Split markdown ## headings into title/body dicts for automation_briefing.json
    and structured UI. Title is the line after '##' (emoji and punctuation preserved).
    """
    text = (briefing or "").strip()
    if not text:
        return []
    matches = list(_HEADING_LINE.finditer(text))
    if not matches:
        return [{"title": "", "body": text}]
    out: list[dict[str, str]] = []
    first_start = matches[0].start()
    if first_start > 0:
        pre = text[:first_start].strip()
        if pre:
            out.append({"title": "", "body": pre})
    for i, m in enumerate(matches):
        title = m.group(1).strip()
        body_start = m.end()
        body_end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[body_start:body_end].strip()
        out.append({"title": title, "body": body})
    return out


def run_automation_pipeline() -> tuple[str, list[dict[str, Any]], str, int, float, float]:
    """
    Inbox since lastScannedAt (or 24h) for drafts; briefing via do_today (24h).
    Returns (briefing, drafts, provider, messages_seen, scan_since, scan_until).
    Summary is computed in run_once after merging persisted drafts.
    """
    from cli.core import (
        do_today,
        generate_reply_drafts,
        get_email_provider_name,
        list_inbox_messages_since,
    )

    now = time.time()
    scan_until = now
    prev = get_last_scanned_at()
    scan_since = prev if prev is not None else (now - DEFAULT_SCAN_LOOKBACK_SEC)

    messages = list_inbox_messages_since(scan_since, max_results=50)
    briefing = _trim_briefing_for_frontend(do_today())
    drafts = generate_reply_drafts(messages)
    provider = get_email_provider_name()
    return briefing, drafts, provider, len(messages), scan_since, scan_until


def run_once() -> bool:
    """
    Scan inbox since last watermark, briefing + reply drafts. Respects running status.
    Advances lastScannedAt only after a successful write.
    Unsent drafts from the briefing file are merged with new LLM drafts (by messageId).
    Returns True if a run was performed, False if skipped.
    """
    if not is_automation_running():
        logger.info("Automation skipped: automation not running")
        return False
    try:
        refresh_writing_style()
        briefing, fresh_drafts, provider, n_msg, scan_since, scan_until = run_automation_pipeline()
        persisted = load_persisted_drafts()
        drafts = merge_drafts_persist(persisted, fresh_drafts)
        if len(persisted) or len(drafts) != len(fresh_drafts):
            logger.info(
                "Drafts: %d persisted + %d new from run -> %d total",
                len(persisted),
                len(fresh_drafts),
                len(drafts),
            )
        summary = daily_summary(briefing, len(drafts))
        logger.info("Automation run completed: %d messages, %d drafts", n_msg, len(drafts))
        logger.info("Summary: %s", summary)
        write_briefing_for_frontend(
            briefing,
            summary,
            drafts=drafts,
            provider=provider,
            scanSince=scan_since,
            scanUntil=scan_until,
            messagesSeen=n_msg,
        )
        set_last_scanned_at(scan_until)
        return True
    except Exception as e:
        logger.exception("Automation run failed: %s", e)
        raise


def run_loop(interval_seconds: int = 3600) -> None:
    """Run automation every interval_seconds (e.g. 3600 = hourly)."""
    import time as time_module

    logger.info("Automation loop started (interval=%ds)", interval_seconds)
    while True:
        run_once()
        time_module.sleep(interval_seconds)
