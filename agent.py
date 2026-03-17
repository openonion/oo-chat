"""
Email Agent - Email reading and management with memory

Purpose: Read, search, and manage your email inbox (Gmail and/or Outlook)
Pattern: Use ConnectOnion email tools + Memory system + Calendar + Shell + Plugins
"""

import json
import os
from connectonion import Agent, Memory, WebFetch, Shell, TodoList
from connectonion.useful_plugins import re_act, gmail_plugin, calendar_plugin
from automation.automation import pause_automation, resume_automation, is_automation_running


# Create shared tool instances
memory = Memory(memory_file="data/memory.md")
web = WebFetch()  # For analyzing contact domains
shell = Shell()  # For running shell commands (e.g., get current date)
todo = TodoList()  # For tracking multi-step tasks

# Build tools list based on .env flags
# Note: Only one email provider at a time (tools have overlapping method names)
has_gmail = os.getenv("LINKED_GMAIL", "").lower() == "true"
has_outlook = os.getenv("LINKED_OUTLOOK", "").lower() == "true"

tools = []
plugins = [re_act]

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

# Select prompt based on linked provider
if has_gmail:
    system_prompt = "prompts/gmail_agent.md"
elif has_outlook:
    system_prompt = "prompts/outlook_agent.md"
else:
    system_prompt = "prompts/gmail_agent.md"  # Default

# Create init sub-agent for CRM database setup
init_crm = Agent(
    name="crm-init",
    system_prompt="prompts/crm_init.md",
    tools=tools + [memory, web],
    max_iterations=30,
    model="co/gemini-3-flash-preview",
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


# Add remaining tools to the list
tools.extend([memory, shell, todo, init_crm_database, pause_automation, resume_automation, is_automation_running])

# Create main agent
agent = Agent(
    name="email-agent",
    system_prompt=system_prompt,
    tools=tools,
    plugins=plugins,
    max_iterations=15,
    model="co/gemini-3-flash-preview",
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
