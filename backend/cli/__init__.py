"""
Email Agent CLI package.

Structure:
- core.py      - Core logic functions (do_inbox, do_search, etc.)
- setup.py     - Auth and CRM setup checks
- interactive.py - Interactive REPL mode
- commands.py  - Typer CLI commands
"""

from .commands import app

__all__ = ['app']
