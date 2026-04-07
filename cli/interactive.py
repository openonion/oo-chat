"""
Interactive mode for Email Agent CLI.

Textual-based chat interface with slash commands and autocomplete.
"""

import subprocess
from pathlib import Path

from connectonion.tui import Chat, CommandItem

from agent import agent
from .core import (
    do_inbox, do_search, do_contacts, do_sync,
    do_init, do_unanswered, do_identity, do_today, do_events, do_weekly_summary,
    do_writing_style, CommandRouter
)
from .contacts_provider import ContactProvider


def _set_env_flag(key: str, value: str):
    """Set a flag in .env file."""
    env_path = Path('.env')

    lines = []
    if env_path.exists():
        lines = env_path.read_text().splitlines()

    found = False
    for i, line in enumerate(lines):
        if line.startswith(f'{key}='):
            lines[i] = f'{key}={value}'
            found = True
            break

    if not found:
        lines.append(f'{key}={value}')

    env_path.write_text('\n'.join(lines) + '\n')


# Commands for autocomplete (main=display text, id=actual command to insert)
COMMANDS = [
    CommandItem(main="/today - Daily briefing", prefix="📅", id="/today"),
    CommandItem(main="/weekly_summary - Weekly email summary", prefix="📬", id="/weekly_summary"),
    CommandItem(main="/events - Extract events from emails", prefix="🗓️", id="/events"),
    CommandItem(main="/inbox - Show emails", prefix="📥", id="/inbox"),
    CommandItem(main="/search - Search emails", prefix="🔍", id="/search "),
    CommandItem(main="/contacts - View contacts", prefix="👥", id="/contacts"),
    CommandItem(main="/sync - Sync contacts", prefix="🔄", id="/sync"),
    CommandItem(main="/init - Initialize CRM", prefix="🗄️", id="/init"),
    CommandItem(main="/unanswered - Pending replies", prefix="⏳", id="/unanswered"),
    CommandItem(main="/identity - Email identity", prefix="🆔", id="/identity"),
    CommandItem(main="/link-gmail - Connect Gmail", prefix="🔗", id="/link-gmail"),
    CommandItem(main="/link-outlook - Connect Outlook", prefix="🔗", id="/link-outlook"),
    CommandItem(main="/help - Show commands", prefix="❓", id="/help"),
    CommandItem(main="/quit - Exit", prefix="👋", id="/quit"),
]


# Welcome message (markdown)
WELCOME = """## Email Agent

**Quick Start:**
- `/inbox` - Check your emails
- `/today` - Daily briefing
- `/weekly_summary` - Past 7 days summary
- `/help` - All commands

Or just type naturally to chat with the AI agent!
"""


# Help message (markdown)
HELP_MESSAGE = """## Commands

### Essential
- `/today` - Daily email briefing
- `/weekly_summary` - Past 7 days summary
- `/inbox [n]` - Show recent emails
- `/events [days] [max_emails]` - Extract events from emails (default: last 7 days, 50 emails)
- `/search query` - Find specific emails
- `/contacts` - View your contacts

### Manage
- `/sync` - Update contacts from Gmail
- `/init` - Setup CRM database
- `/unanswered` - Find pending replies

### Other
- `/identity` - Your email config
- `/link-gmail` - Connect Gmail account
- `/link-outlook` - Connect Outlook account
- `/quit` - Exit the app

**Tip:** Just type naturally to chat with the AI agent!
"""


def _handle_error(error: Exception) -> str:
    """Format error message for display."""
    error_msg = str(error).lower()

    if 'credential' in error_msg or 'auth' in error_msg or 'token' in error_msg:
        return (
            f"**Authentication error**\n\n"
            f"`{error}`\n\n"
            "**To fix:**\n"
            "1. Run: `co auth google`\n"
            "2. Grant Gmail permissions\n"
            "3. Try again"
        )
    elif 'network' in error_msg or 'connection' in error_msg or 'timeout' in error_msg:
        return (
            f"**Network error**\n\n"
            f"`{error}`\n\n"
            "**To fix:** Check your internet connection"
        )
    else:
        return f"**Error**\n\n`{error}`\n\nTry `/help` to see available commands"


def interactive():
    """Full interactive mode with chat UI."""
    # Load contacts for @ autocomplete
    contact_provider = ContactProvider()
    contacts = contact_provider.to_command_items()

    # Wrap agent so "add X" follow-ups after /events are handled without going to the LLM
    router = CommandRouter(agent)

    # Create chat UI
    chat = Chat(
        agent=router,
        title="Email Agent",
        triggers={
            "/": COMMANDS,
            "@": contacts,
        },
        welcome=WELCOME,
        hints=["/ commands", "@ contacts", "Enter send", "Ctrl+D quit"],
        status_segments=[
            ("📧", "Email Agent", "cyan"),
            ("🤖", f"co/{agent.llm.model}", "magenta"),
        ],
        on_error=_handle_error,
    )

    # Register command handlers
    chat.command("/help", lambda _: HELP_MESSAGE)

    chat.command("/today", lambda _: do_today())
    chat.command("/weekly_summary", lambda _: do_weekly_summary())

    def _events(text: str) -> str:
        parts = text.split()
        digits = [int(p) for p in parts[1:] if p.isdigit()]
        days = digits[0] if len(digits) > 0 else 7
        max_emails = digits[1] if len(digits) > 1 else 50
        display_text, events = do_events(days=days, max_emails=max_emails)
        # Store events on the router so a follow-up "add X" message is handled by do_create_events rather than forwarded to the LLM agent
        object.__setattr__(router, '_pending_events', events if events else None)
        return display_text

    chat.command("/events", _events)

    def _inbox(text: str) -> str:
        parts = text.split()
        count = int(parts[1]) if len(parts) > 1 else 10
        return do_inbox(count=count)

    chat.command("/inbox", _inbox)

    def _search(text: str) -> str:
        query = text[7:].strip()
        if not query:
            return "Please provide a search query: `/search your query`"
        return do_search(query=query)

    chat.command("/search", _search)

    chat.command("/contacts", lambda _: do_contacts())
    chat.command("/sync", lambda _: do_sync())
    chat.command("/init", lambda _: do_init())
    chat.command("/unanswered", lambda _: do_unanswered())
    chat.command("/identity", lambda _: do_identity())

    def _writing_style(text: str) -> str:
        parts = text.split()
        count = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 30
        return do_writing_style(count=count)

    chat.command("/writing_style", _writing_style)

    def _link_gmail(_: str) -> str:
        subprocess.run(['co', 'auth', 'google'])
        _set_env_flag('LINKED_GMAIL', 'true')
        return "Gmail connected. Restart the CLI to use it."

    chat.command("/link-gmail", _link_gmail)

    def _link_outlook(_: str) -> str:
        subprocess.run(['co', 'auth', 'microsoft'])
        _set_env_flag('LINKED_OUTLOOK', 'true')
        return "Outlook connected. Restart the CLI to use it."

    chat.command("/link-outlook", _link_outlook)

    # Run the chat UI
    chat.run()
