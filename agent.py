"""
Email Agent - Email reading and management with memory

Purpose: Read, search, and manage your email inbox (Gmail and/or Outlook)
Pattern: Use ConnectOnion email tools + Memory system + Calendar + Shell + Plugins
"""

import os, time, json, re
from connectonion import Agent, WebFetch, Shell, TodoList
from memory import Memory
from pathlib import Path
from connectonion.useful_plugins import gmail_plugin, calendar_plugin, skills
from connectonion.useful_plugins.re_act import acknowledge_request
from connectonion.core.events import after_tools
from automation.automation import pause_automation, resume_automation, is_automation_running
from subscriptions import write_subscriptions_for_frontend

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
# Create Memory class and isolate necessary methods
memory = Memory(memory_dir="data/memory")
read_memory = memory.read_memory
write_memory = memory.write_memory
update_memory = memory.update_memory
list_memories = memory.list_memories
search_memory = memory.search_memory

web = WebFetch()  # For analyzing contact domains
shell = Shell()  # For running shell commands (e.g., get current date)
todo = TodoList()  # For tracking multi-step tasks

# Build tools list based on .env flags
# Note: Only one email provider at a time (tools have overlapping method names)
has_gmail = os.getenv("LINKED_GMAIL", "").lower() == "true"
has_outlook = os.getenv("LINKED_OUTLOOK", "").lower() == "true"

# Main additional tools needed for the agent
tools = [read_memory, write_memory, update_memory, search_memory, list_memories, shell, todo, pause_automation, resume_automation, is_automation_running]
plugins = [custom_re_act, skills]
# Agent LLM model
agent_model = "co/gemini-3-flash-preview"

# Email/calendar tool instances
email_instance = None
calendar_instance = None

# Prefer Gmail if both are linked (can only use one due to method name conflicts)
if has_gmail:
    from connectonion import Gmail, GoogleCalendar
    email_instance = Gmail()
    calendar_instance = GoogleCalendar()
    plugins.append(gmail_plugin)
    plugins.append(calendar_plugin)
elif has_outlook:
    from connectonion import Outlook, MicrosoftCalendar
    email_instance = Outlook()
    calendar_instance = MicrosoftCalendar()

# Warn if no email provider configured
if not email_instance:
    print("\n⚠️  No email account connected. Use /link-gmail or /link-outlook to connect.\n")

# Select system prompt based on linked provider
if has_gmail:
    system_prompt = "prompts/gmail_agent.md"
elif has_outlook:
    system_prompt = "prompts/outlook_agent.md"
else:
    system_prompt = "prompts/gmail_agent.md"  # Default

if "gemini" in agent_model:
    subscription_checker_prompt = "prompts/subscription_checker_gemini.md"
else:
    subscription_checker_prompt = "prompts/subscription_checker.md"

# Create init sub-agent for CRM database setup (gets full email instance)
crm_tools = [email_instance, read_memory, write_memory, update_memory, search_memory, web]
init_crm = Agent(
    name="crm-init",
    system_prompt="prompts/crm_init.md",
    tools=crm_tools,
    max_iterations=30,
    model=agent_model,
    log=False  # Don't create separate log file
)

# exclude the expensive API calls from the email instance for the main agent so it stops calling them like an idiot
# the CRM init agent gets the full email instance, so it can analyse contacts fully
EXCLUDED_EMAIL_METHODS = {
    "get_all_contacts", "sync_contacts", "analyze_contact", "get_cached_contacts", "update_contact",
    "bulk_update_contacts", "detect_all_my_emails", "get_all_my_emails",
    "sync_emails",
}

# Build tools for main agent
if email_instance:
    for name in dir(email_instance):
        if name.startswith("_") or name in EXCLUDED_EMAIL_METHODS:
            continue
        method = getattr(email_instance, name)
        if callable(method):
            tools.append(method)

if calendar_instance:
    tools.append(calendar_instance)

# Custom tool for subscription manager sub-agent
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

tools.append(check_subscriptions)

# Custom tool for main agent
def make_draft(to: str, subject: str, body: str) -> str:
    """Draft an email for the user to review before sending.
    ALWAYS call this tool immediately when the user asks to draft an email.
    Fill in ALL fields using your best judgment — never ask the user for more details.
    The user will edit the draft in a review modal, so a best-effort draft is expected."""
    return json.dumps({"to": to, "subject": subject, "body": body})

# Create subscription checker sub-agent
subscription_checker = Agent(
    name="subscription-checker",
    system_prompt=subscription_checker_prompt,
    tools=tools,
    max_iterations=30,
    model=agent_model,
    log=False,
)

# Create main agent
agent = Agent(
    name="email-agent",
    system_prompt=system_prompt,
    tools=tools + [make_draft],
    plugins=plugins,
    max_iterations=15,
    model=agent_model,
)

def init_crm_database(max_emails: int = 500, exclude_domains: str = "openonion.ai,connectonion.com") -> str:
    """Initialize CRM database by extracting contacts.

    Args:
        max_emails: Number of emails to scan for contacts (default: 500)
        exclude_domains: Comma-separated domains to exclude (your org domains)

    Returns:
        Summary of initialization process including number of contacts analyzed
    """

    start = time.perf_counter()
    from pathlib import Path
    contacts_csv = Path("data/contacts.csv")
    contacts_dir = Path("data/memory/contacts")

    if contacts_csv.exists():
        csv_content = contacts_csv.read_text()
        result = init_crm.input(
            f"Initialize CRM: contacts.csv already exists. Create contact files from the CSV data below.\n"
            f"DO NOT call get_all_contacts(). The data is already here.\n"
            f"Use AI judgment to only create files for real, important people.\n\n"
            f"--- contacts.csv ---\n{csv_content}"
        )
    else:
        result = init_crm.input(
            f"Initialize CRM: Extract contacts from up to {max_emails} latest emails.\n"
            f"IMPORTANT: Use get_all_contacts(max_emails={max_emails}, exclude_domains=\"{exclude_domains}\")\n"
            f"Then use AI judgment to only setup the most useful and important contacts."
        )

    for contact_file in sorted(contacts_dir.glob("*.md")):
        email = contact_file.stem
        init_crm.input(f"""Enrich the contact file for {email}.

1. read_memory("contact:{email}") — see what's already saved
2. search_emails("from:{email}", 15) — emails received from them
3. search_emails("to:{email}", 15) — emails you sent to them
4. get_email_body() on 2-3 of the most informative ones (skip receipts, calendar invites, one-liners)
5. update_memory("contact:{email}", ...) with this structure:
---
name: <full name>
company: <their company if known>
role: <their job title or function if known>
relationship: <one of: client, colleague, family, friend, contact>
priority: <high / medium / low — based on email frequency and importance>
tags: [<relevant keywords>]
---

## About
2-3 sentences: who they are, how you know them, nature of the relationship.

## Key Topics
Bullet list of recurring subjects or projects discussed.

## Language
Brief summary of the tone and language used between this contact and the user

## Thread History
Dated bullet list of notable interactions (most recent first):
- YYYY-MM-DD: <what happened>

If there are zero emails from and to this contact, just add a note:
"No email history found."

Use update_memory (not write_memory) to preserve existing frontmatter fields.
Only include fields you can actually infer — don't fabricate details."""
)
    end = time.perf_counter()
    # Return clear completion message so main agent knows not to call again
    return f"CRM INITIALIZATION COMPLETE in {end - start:.2f} seconds. \n{result}\nContacts saved to memory/contacts, to browse contacts use list_memories('contacts')"