#!/usr/bin/env python3
"""
Run daily/hourly automation (same logic as /today + daily summary).

Use from cron for scheduled runs, or run with --loop for an in-process hourly loop.
Pause via automation_config.json {"running": false}.

Examples:
  # One-shot (for cron)
  cd backend && python run_automation.py

  # Hourly loop (e.g. in systemd or screen)
  cd backend && python run_automation.py --loop --interval 3600

  # Pause: write automation_config.json {"running": false}
  echo '{"running": false}' > backend/automation_config.json

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
        description="Run /today automation once or in a loop (respects automation_config.json)"
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
