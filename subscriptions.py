import json, re, time
from pathlib import Path

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
