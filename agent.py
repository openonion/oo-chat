"""
Email Agent - Email reading and management with memory

Purpose: Read, search, and manage your email inbox (Gmail and/or Outlook)
Pattern: Use ConnectOnion email tools + Memory system + Calendar + Shell + Plugins
"""

import json
import os
import time
import re
from pathlib import Path

from connectonion import Agent, Memory, WebFetch, Shell, TodoList
from connectonion.useful_plugins import gmail_plugin, calendar_plugin
from connectonion.useful_plugins.re_act import acknowledge_request
from connectonion.core.events import after_tools
from automation.automation import pause_automation, resume_automation, is_automation_running

_AGENT_ROOT = Path(__file__).resolve().parent


@after_tools
def reflect(agent) -> None:
    """Custom reflect: keeps multi-step reasoning intact while preventing premature 'task complete'."""
    trace = agent.current_session['trace'][-1]
    if trace['type'] != 'tool_result':
        return

    tool_name = trace['name']
    status = trace['status']

    if status == 'success':
        result_preview = str(trace['result'])[:300]
        msg = f"Got result from {tool_name}: {result_preview}\nContinue with next steps, or if this was the final step, present the full result to the user."
    else:
        error = trace.get('error', 'Unknown error')
        msg = f"{tool_name} failed: {error}. Inform the user and suggest next steps."

    agent.current_session['messages'].append({
        'role': 'assistant',
        'content': msg
    })


custom_re_act = [acknowledge_request, reflect]


# Create shared tool instances
memory = Memory(memory_file=str(_AGENT_ROOT / "data" / "memory.md"))
web = WebFetch()  # For analyzing contact domains
shell = Shell()  # For running shell commands (e.g., get current date)
todo = TodoList()  # For tracking multi-step tasks

# Build tools list based on .env flags
# Note: Only one email provider at a time (tools have overlapping method names)
has_gmail = os.getenv("LINKED_GMAIL", "").lower() == "true"
has_outlook = os.getenv("LINKED_OUTLOOK", "").lower() == "true"

tools = []
plugins = [custom_re_act]

# Prefer Gmail if both are linked (can only use one due to method name conflicts)
if has_gmail:
    from connectonion import Gmail, GoogleCalendar
    tools.append(Gmail())
    tools.append(GoogleCalendar())
    plugins.append(gmail_plugin)
    plugins.append(calendar_plugin)
elif has_outlook:
    from connectonion import Outlook, MicrosoftCalendar
    tools.append(Outlook())
    tools.append(MicrosoftCalendar())

# Warn if no email provider configured
if not tools:
    print("\n⚠️  No email account connected. Use /link-gmail or /link-outlook to connect.\n")

# Select prompt based on linked provider (Path so cwd does not matter for tests / subprocesses)
if has_gmail:
    system_prompt = _AGENT_ROOT / "prompts" / "gmail_agent.md"
elif has_outlook:
    system_prompt = _AGENT_ROOT / "prompts" / "outlook_agent.md"
else:
    system_prompt = _AGENT_ROOT / "prompts" / "gmail_agent.md"  # Default

agent_model = "co/gemini-3-flash-preview"
if "gemini" in agent_model:
    subscription_checker_prompt = "prompts/subscription_checker_gemini.md"
else:
    subscription_checker_prompt = "prompts/subscription_checker.md"

# Create init sub-agent for CRM database setup
init_crm = Agent(
    name="crm-init",
    system_prompt=_AGENT_ROOT / "prompts" / "crm_init.md",
    tools=tools + [memory, web],
    max_iterations=30,
    model=agent_model,
    log=False  # Don't create separate log file
)


def init_crm_database(max_emails: int = 500, top_n: int = 10, exclude_domains: str = "openonion.ai,connectonion.com") -> str:
    """Initialize CRM database by extracting and analyzing top contacts.

    Args:
        max_emails: Number of emails to scan for contacts (default: 500)
        top_n: Number of top contacts to analyze and save (default: 10)
        exclude_domains: Comma-separated domains to exclude (your org domains)

    Returns:
        Summary of initialization process including number of contacts analyzed
    """
    result = init_crm.input(
        f"Initialize CRM: Extract top {top_n} contacts from {max_emails} emails.\n"
        f"IMPORTANT: Use get_all_contacts(max_emails={max_emails}, exclude_domains=\"{exclude_domains}\")\n"
        f"Then use AI judgment to categorize and analyze the most important contacts."
    )
    # Return clear completion message so main agent knows not to call again
    return f"CRM INITIALIZATION COMPLETE. Data saved to memory. Use read_memory() to access:\n- crm:all_contacts\n- crm:needs_reply\n- crm:init_report\n- contact:email@example.com\n\nDetails: {result}"

# Create subscription checker sub-agent
subscription_checker = Agent(
    name="subscription-checker",
    system_prompt=subscription_checker_prompt,
    tools=tools + [memory, shell],
    max_iterations=30,
    model=agent_model,
    log=False,
)
SUBSCRIPTIONS_FILE = Path(__file__).resolve().parent / "data" / "subscriptions.json"
UNSUBSCRIBED_FILE = Path(__file__).resolve().parent / "data" / "unsubscribed.json"
 
def get_unsubscribed_emails() -> set:
    """Read the list of unsubscribed sender emails."""
    if not UNSUBSCRIBED_FILE.exists():
        return set()
    try:
        data = json.loads(UNSUBSCRIBED_FILE.read_text(encoding="utf-8"))
        return {entry["sender_email"] for entry in data}
    except Exception:
        return set()
 
def write_subscriptions_for_frontend(raw_result: str) -> None:
    """Parse subscription results and write to data/subscriptions.json for oo-chat to display."""
    SUBSCRIPTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
 
    subscriptions_data = None
 
    # Try 1: Look for a JSON object in the result
    try:
        start = raw_result.index('{')
        end = raw_result.rindex('}') + 1
        json_str = raw_result[start:end]
        subscriptions_data = json.loads(json_str)
    except (ValueError, json.JSONDecodeError):
        pass
 
    # Try 2: Parse the markdown format the agent returns
    if subscriptions_data is None:
        subscriptions_data = parse_markdown_subscriptions(raw_result)
 
    # Fallback: store raw text
    if subscriptions_data is None:
        subscriptions_data = {"raw": raw_result}
 
    payload = {
        "lastUpdated": time.time(),
        "data": subscriptions_data,
    }
 
    SUBSCRIPTIONS_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
 
def parse_markdown_subscriptions(text: str) -> dict | None:
    """Parse markdown-formatted subscription results into structured JSON.
 
    Expects format like:
    ### Category Name
    - **Sender** (`email@example.com`): [Unsubscribe](URL) | [View Email](URL)
    - **Sender** (`email@example.com`): No direct unsubscribe link. | [View Email](URL)
    """
    categories = {}
    current_category = None
 
    for line in text.split('\n'):
        line = line.strip()
 
        # Match category headers: ### Category Name or **Category Name**
        category_match = re.match(r'^#{1,3}\s+(.+)$', line)
        if category_match:
            current_category = category_match.group(1).strip()
            categories[current_category] = []
            continue
 
        # Match subscription entries
        if current_category and (line.startswith('- **') or line.startswith('* **')):
            entry = parse_subscription_line(line)
            if entry:
                categories[current_category].append(entry)
 
    # Return None if nothing was parsed
    if not categories or all(len(v) == 0 for v in categories.values()):
        return None
 
    return categories
 
def parse_subscription_line(line: str) -> dict | None:
    """Parse a single subscription line into structured data.
 
    Handles formats like:
    - **Sender** (`email@example.com`): [Unsubscribe](URL) | [View Email](URL)
    - **Sender** (`email`): No direct unsubscribe link. | [View Email](URL)
    """
    # Extract sender name
    name_match = re.search(r'\*\*(.+?)\*\*', line)
    if not name_match:
        return None
    sender_name = name_match.group(1)
 
    # Extract email address
    email_match = re.search(r'[`(]([a-zA-Z0-9_.+\-@]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]+)[`)]', line)
    sender_email = email_match.group(1) if email_match else ""
 
    # Extract unsubscribe link
    unsub_match = re.search(r'\[Unsubscribe\]\(([^)]+)\)', line)
    if unsub_match:
        unsubscribe_link = unsub_match.group(1)
    elif 'no direct unsubscribe' in line.lower():
        unsubscribe_link = "No direct unsubscribe link."
    else:
        unsubscribe_link = "not found"
 
    # Extract email web link
    email_link_match = re.search(r'\[View Email\]\(([^)]+)\)', line)
    email_web_link = email_link_match.group(1) if email_link_match else "not available"
 
    return {
        "sender_name": sender_name,
        "sender_email": sender_email,
        "unsubscribe_link": unsubscribe_link,
        "email_web_link": email_web_link,
    }

def check_subscriptions() -> str:
    # Clear old cached results so we always do a fresh scan
    try:
        memory.write_memory("subscriptions:all", "")
    except Exception:
        pass
 
    result = subscription_checker.input(
        "Check for subscription emails.\n"
        "\n"
        "1. Search the last 50 emails using search_emails.\n"
        "   Do NOT check memory first - always do a fresh scan.\n"
        "\n"
        "2. Group by sender, only keep senders with 2+ emails.\n"
        "3. For each recurring sender, call get_email_body to find:\n"
        "   - The unsubscribe link (List-Unsubscribe header or body link)\n"
        "   - The email web link (to view in Gmail)\n"
        "4. Classify each sender.\n"
        "5. Save results to memory with write_memory('subscriptions:all', results).\n"
        "6. Return the full results."
    )
 
    # Write to JSON file for frontend
    write_subscriptions_for_frontend(result)
 
    return f"CHECK COMPLETE.\n\n{result}"

def make_draft(to: str, subject: str, body: str) -> str:
    """Draft an email for the user to review before sending.
    ALWAYS call this tool immediately when the user asks to draft an email.
    Fill in ALL fields using your best judgment — never ask the user for more details.
    The user will edit the draft in a review modal, so a best-effort draft is expected."""
    return json.dumps({"to": to, "subject": subject, "body": body})

# Add remaining tools to the list
tools.extend([memory, shell, todo, init_crm_database, pause_automation, resume_automation, is_automation_running, check_subscriptions, make_draft])

# Create main agent
agent = Agent(
    name="email-agent",
    system_prompt=system_prompt,
    tools=tools,
    plugins=plugins,
    max_iterations=15,
    model=agent_model,
)

# Example usage
if __name__ == "__main__":
    print("=== Email Agent ===\n")

    # Example 1: Initialize CRM database using wrapper function
    print("1. Initialize CRM database...")
    result = agent.input(
        "Initialize the CRM database with top 5 contacts from recent 500 emails"
    )
    print(result)

    print("\n" + "="*50 + "\n")

    # Example 2: Query from MEMORY (should NOT re-fetch from API)
    print("2. Query from memory (should be fast)...")
    result = agent.input("Who do I email the most? Check memory first.")
    print(result)
