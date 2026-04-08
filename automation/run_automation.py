#!/usr/bin/env python3
"""
Run scheduled automation: inbox since lastScannedAt (or last 24h), briefing, reply drafts.

Updates lastScannedAt in automation_config.json after each successful run.
Pause via automation_config.json {"running": false}.

Examples:
  # One-shot (for cron) — from capstone project root (parent of automation/)
  python3 automation/run_automation.py

  # Hourly loop
  python3 automation/run_automation.py --loop --interval 3600

Options:
- --loop: Run every --interval seconds instead of once (for cron, omit this)
- --interval: Loop interval in seconds (default 3600 = hourly)
- -v, --verbose: Log at INFO level
"""

from pathlib import Path
import argparse
import logging
import os
import sys

# Run from backend directory so agent and prompts resolve
_backend_dir = Path(__file__).resolve().parent.parent
os.chdir(_backend_dir)
if _backend_dir not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from automation import run_once, run_loop, is_automation_running


def main():
    parser = argparse.ArgumentParser(
        description="Run inbox scan + briefing + drafts once or in a loop (respects automation_config.json)"
    )
    parser.add_argument(
        "--loop",
        action="store_true",
        help="Run every --interval seconds instead of once (for cron, omit this)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=3600,
        metavar="SECONDS",
        help="Loop interval in seconds (default 3600 = hourly)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Log at INFO level",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    logger = logging.getLogger(__name__)

    if not is_automation_running():
        logger.info("Automation is not running according to automation_config.json. Exiting.")
        return 0

    if args.loop:
        run_loop(interval_seconds=args.interval)
    else:
        run_once()
    return 0


if __name__ == "__main__":
    sys.exit(main())
