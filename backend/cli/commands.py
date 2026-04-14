"""
Typer CLI commands for Email Agent.

All commands use the core do_* functions from cli.core.
"""

import typer
from rich.console import Console
from rich.panel import Panel
from rich.markdown import Markdown

from .core import (
    do_inbox, do_search, do_contacts, do_sync,
    do_init, do_unanswered, do_identity, do_today, do_weekly_summary,
    do_events, do_create_events, do_writing_style, do_ask, do_host
)
from .setup import check_setup
from .interactive import interactive

app = typer.Typer(
    name="email",
    help="Email Agent - Interactive email management from your terminal",
    invoke_without_command=True
)
console = Console()


@app.callback()
def main(ctx: typer.Context):
    """Email Agent - Interactive email management from your terminal."""
    if ctx.invoked_subcommand is None:
        if check_setup():
            interactive()


@app.command()
def inbox(
    count: int = typer.Option(10, "--count", "-n", help="Number of emails to show"),
    unread: bool = typer.Option(False, "--unread", "-u", help="Only show unread emails")
):
    """Show recent inbox emails."""
    with console.status("[bold blue]Fetching emails...[/bold blue]"):
        result = do_inbox(count=count, unread=unread)
    console.print(Panel(result, title="[bold]Inbox[/bold]", border_style="green"))


@app.command()
def search(
    query: str = typer.Argument(..., help="Gmail search query"),
    count: int = typer.Option(10, "--count", "-n", help="Number of results")
):
    """Search emails using Gmail query syntax."""
    with console.status(f"[bold blue]Searching...[/bold blue]"):
        result = do_search(query=query, count=count)
    console.print(Panel(result, title=f"[bold]Search: {query}[/bold]", border_style="yellow"))


@app.command()
def contacts():
    """Show cached contacts."""
    result = do_contacts()
    console.print(Panel(result, title="[bold]Contacts[/bold]", border_style="cyan"))


@app.command()
def sync(
    max_emails: int = typer.Option(500, "--max", "-m", help="Max emails to scan"),
    exclude: str = typer.Option("openonion.ai,connectonion.com", "--exclude", "-e", help="Domains to exclude")
):
    """Sync contacts from Gmail."""
    with console.status("[bold blue]Syncing contacts...[/bold blue]"):
        result = do_sync(max_emails=max_emails, exclude=exclude)
    console.print(Panel(result, title="[bold]Sync Complete[/bold]", border_style="green"))


@app.command()
def init(
    max_emails: int = typer.Option(500, "--max", "-m", help="Max emails to scan"),
    exclude: str = typer.Option("openonion.ai,connectonion.com", "--exclude", "-e", help="Domains to exclude")
):
    """Initialize CRM database."""
    console.print("[dim]Initializing CRM (this may take a few minutes)...[/dim]")
    with console.status("[bold blue]Processing...[/bold blue]"):
        result = do_init(max_emails=max_emails, exclude=exclude)
    console.print(Panel(Markdown(result), title="[bold green]CRM Initialized[/bold green]", border_style="green"))


@app.command()
def unanswered(
    days: int = typer.Option(120, "--days", "-d", help="Look back N days"),
    count: int = typer.Option(20, "--count", "-n", help="Max results")
):
    """Find emails you haven't replied to."""
    with console.status("[bold blue]Finding unanswered emails...[/bold blue]"):
        result = do_unanswered(days=days, count=count)
    console.print(Panel(result, title="[bold]Unanswered[/bold]", border_style="red"))


@app.command()
def identity(detect: bool = typer.Option(False, "--detect", "-d", help="Detect forwarded addresses")):
    """Show your email identity."""
    with console.status("[bold blue]Getting identity...[/bold blue]"):
        result = do_identity(detect=detect)
    console.print(Panel(result, title="[bold]Identity[/bold]", border_style="cyan"))


@app.command()
def today():
    """Daily email briefing."""
    console.print("[dim]Analyzing today's emails...[/dim]")
    with console.status("[bold blue]Fetching and analyzing...[/bold blue]"):
        result = do_today()
    console.print(Panel(Markdown(result), title="[bold blue]Today's Briefing[/bold blue]", border_style="blue"))

@app.command()
def weekly_summary():
    """Weekly email summary with stats and action items."""
    console.print("[dim]Analyzing your emails from the past 7 days...[/dim]")
    with console.status("[bold blue]Fetching and analyzing...[/bold blue]"):
        result = do_weekly_summary()
    console.print(Panel(Markdown(result), title="[bold green]📬 Weekly Summary[/bold green]", border_style="green"))

@app.command()
def events(
    days: int = typer.Option(7, "--days", "-d", help="How many days back to scan"),
    max_emails: int = typer.Option(50, "--max-emails", "-n", help="Maximum number of emails to scan"),
):
    """Extract events and meetings from recent emails."""
    console.print(f"[dim]Scanning last {days} days for events (up to {max_emails} emails)...[/dim]")
    with console.status("[bold blue]Extracting events...[/bold blue]"):
        display_text, events_list = do_events(days=days, max_emails=max_emails)
    console.print(Panel(Markdown(display_text), title="[bold blue]Extracted Events[/bold blue]", border_style="blue"))

    if not events_list:
        return

    # Single confirmation — user says "add 1", "add 1,3", or "add all"
    try:
        reply = console.input("[bold blue]>[/bold blue] ").strip()
    except (EOFError, KeyboardInterrupt):
        return
    if not reply or reply.lower() in ("q", "quit", "exit", "skip", "no", "none"):
        return
    with console.status("[bold blue]Adding to calendar...[/bold blue]"):
        result = do_create_events(events_list, reply)
    console.print(Panel(Markdown(result), title="[bold blue]Calendar[/bold blue]", border_style="green"))


@app.command()
def writing_style(
    count: int = typer.Option(30, "--count", "-n", help="Number of sent emails to analyze")
):
    """Analyze your sent emails to learn your writing style."""
    console.print(f"[dim]Analyzing your last {count} sent emails...[/dim]")
    with console.status("[bold blue]Learning your writing style...[/bold blue]"):
        result = do_writing_style(count=count)
    console.print(Panel(Markdown(result), title="[bold green]✍️  Writing Style Profile[/bold green]", border_style="green"))


@app.command()
def ask(question: str = typer.Argument(..., help="Question to ask the agent")):
    """Ask a single question to the Gmail agent."""
    with console.status("[bold blue]Thinking...[/bold blue]"):
        result = do_ask(question)
    console.print(Panel(Markdown(result), title="[bold blue]Agent[/bold blue]", border_style="blue"))


@app.command()
def host(
    port: int = typer.Option(8000, "--port", "-p", help="Port to listen on"),
    trust: str = typer.Option("careful", "--trust", "-t", help="Trust level: open/careful/strict")
):
    """Start as HTTP/WebSocket server."""
    console.print(f"[bold cyan]Starting server on port {port}...[/bold cyan]")
    do_host(port=port, trust=trust)
