"""
Structured markdown memory system for the Email Agent.

Replaces the ConnectOnion Memory tool with a directory-based system
that uses YAML frontmatter for queryable metadata.

Storage layout:
    data/memory/
    ├── contacts/          # One file per person (keyed by email)
    └── threads/           # Ongoing email threads/projects

Usage:
    from memory import Memory

    memory = Memory()  # defaults to data/memory/
    agent = Agent("email-agent", tools=[memory])

    # Agent can use:
    #   write_memory(key, content)        - auto-routes by prefix
    #   read_memory(key)                  - read a memory
    #   update_memory(key, content)       - append/merge instead of overwrite
    #   list_memories(category)           - list keys, optionally filtered
    #   search_memory(query)              - full-text search across all files
    #   log_action(contact_email, action) - timestamped interaction log
    #
    # Keys without a recognized prefix are stored directly in data/memory/
"""

import os
import re
from datetime import datetime, date
from typing import Optional


# Categories and their directory names
CATEGORIES = {
    "contact": "contacts",
    "thread": "threads",
}

# Default category when no prefix matches — stored directly in data/memory/
DEFAULT_CATEGORY = ""


def _parse_frontmatter(text: str) -> tuple[dict, str]:
    """Parse YAML frontmatter from markdown text.

    Returns (metadata_dict, body_text). If no frontmatter found,
    returns (empty dict, original text).
    """
    if not text.startswith("---"):
        return {}, text

    end = text.find("\n---", 3)
    if end == -1:
        return {}, text

    frontmatter_str = text[4:end]  # skip opening "---\n"
    body = text[end + 4:].lstrip("\n")  # skip closing "---\n"

    metadata = {}
    for line in frontmatter_str.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ": " in line:
            k, v = line.split(": ", 1)
            k = k.strip()
            v = v.strip()
            # Parse YAML-ish values
            if v.startswith("[") and v.endswith("]"):
                # List: [tag1, tag2]
                v = [item.strip() for item in v[1:-1].split(",") if item.strip()]
            elif v.lower() in ("true", "false"):
                v = v.lower() == "true"
            metadata[k] = v

    return metadata, body


def _serialize_frontmatter(metadata: dict, body: str) -> str:
    """Serialize metadata dict + body into markdown with YAML frontmatter."""
    if not metadata:
        return body

    lines = ["---"]
    for k, v in metadata.items():
        if isinstance(v, list):
            lines.append(f"{k}: [{', '.join(str(i) for i in v)}]")
        elif isinstance(v, bool):
            lines.append(f"{k}: {'true' if v else 'false'}")
        else:
            lines.append(f"{k}: {v}")
    lines.append("---")
    lines.append("")

    return "\n".join(lines) + body


def _today() -> str:
    return date.today().isoformat()


def _now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M")


class Memory:
    """Structured markdown memory with YAML frontmatter and categorized directories."""

    def __init__(self, memory_dir: str = "data/memory"):
        self.memory_dir = memory_dir
        os.makedirs(memory_dir, exist_ok=True)
        for subdir in CATEGORIES.values():
            os.makedirs(os.path.join(memory_dir, subdir), exist_ok=True)

    def _resolve_path(self, key: str) -> tuple[str, str, str]:
        """Resolve a key to (category_dir, filename, clean_key).

        Keys like 'contact:lisa@notion.so' route to contacts/lisa@notion.so.md
        Keys without a prefix go to data/memory/ (root).
        """
        for prefix, dirname in CATEGORIES.items():
            if key.startswith(f"{prefix}:"):
                clean_key = key[len(prefix) + 1:]
                return dirname, f"{self._safe_filename(clean_key)}.md", clean_key

        return DEFAULT_CATEGORY, f"{self._safe_filename(key)}.md", key

    def _safe_filename(self, name: str) -> str:
        """Sanitize a string for use as a filename. Allows @ and . for emails."""
        safe = re.sub(r'[^\w@.\-]', '_', name).strip('_')
        return safe.lower() if safe else "unnamed"

    def _full_path(self, category_dir: str, filename: str) -> str:
        return os.path.join(self.memory_dir, category_dir, filename)

    def _read_file(self, filepath: str) -> tuple[dict, str] | None:
        """Read and parse a memory file. Returns None if not found."""
        if not os.path.exists(filepath):
            return None
        with open(filepath, "r") as f:
            return _parse_frontmatter(f.read())

    def _write_file(self, filepath: str, metadata: dict, body: str):
        """Write a memory file with frontmatter."""
        with open(filepath, "w") as f:
            f.write(_serialize_frontmatter(metadata, body))

    def write_memory(self, key: str, content: str) -> str:
        """Save content to memory. Overwrites if key exists.

        Keys are auto-routed by prefix:
          - contact:email   -> contacts/ directory
          - thread:name     -> threads/ directory
          - anything else   -> data/memory/ directory (root)

        Args:
            key: Memory key (e.g. 'contact:lisa@notion.so', 'thread:acme-deal', 'user_style')
            content: Content to store (markdown supported)

        Returns:
            Confirmation message
        """
        category_dir, filename, clean_key = self._resolve_path(key)
        filepath = self._full_path(category_dir, filename)

        # Build metadata
        existing = self._read_file(filepath)
        if existing:
            metadata, _ = existing
            metadata["last_updated"] = _today()
        else:
            metadata = {"created_at": _today(), "last_updated": _today()}
            if category_dir == "contacts":
                metadata["email"] = clean_key

        # Parse any frontmatter the agent included in the content itself
        content_meta, body = _parse_frontmatter(content)
        if content_meta:
            metadata.update(content_meta)

        self._write_file(filepath, metadata, body)
        location = f"{category_dir}/{filename}" if category_dir else filename
        return f"Memory saved: {key} ({location})"

    def read_memory(self, key: str) -> str:
        """Read content from memory.

        Args:
            key: Memory key (e.g. 'contact:lisa@notion.so', 'user_style')

        Returns:
            Memory content or error message
        """
        category_dir, filename, clean_key = self._resolve_path(key)
        filepath = self._full_path(category_dir, filename)

        result = self._read_file(filepath)
        if result is None:
            # List available keys in the same category
            cat_path = os.path.join(self.memory_dir, category_dir) if category_dir else self.memory_dir
            available = self._list_keys_in(cat_path)
            avail_str = ", ".join(available) if available else "none"
            location = f"{category_dir}/" if category_dir else "memory root"
            return f"Memory not found: {key}\nAvailable in {location}: {avail_str}"

        metadata, body = result

        # Format output with metadata summary
        lines = [f"Memory: {key}"]
        if metadata:
            meta_items = [f"{k}: {v}" for k, v in metadata.items()
                          if k not in ("created_at", "last_updated")]
            if meta_items:
                lines.append("  " + " | ".join(meta_items))
            lines.append(f"  (updated: {metadata.get('last_updated', 'unknown')})")
        lines.append("")
        lines.append(body)
        return "\n".join(lines)

    def update_memory(self, key: str, content: str) -> str:
        """Append content to an existing memory, or create it if new.

        For contacts, merges frontmatter fields (new values override old).
        For all types, appends the body text with a timestamp separator.

        Args:
            key: Memory key
            content: Content to append (can include frontmatter for field updates)

        Returns:
            Confirmation message
        """
        category_dir, filename, clean_key = self._resolve_path(key)
        filepath = self._full_path(category_dir, filename)

        existing = self._read_file(filepath)

        if existing is None:
            # No existing file, just write fresh
            return self.write_memory(key, content)

        old_meta, old_body = existing

        # Parse incoming content for frontmatter
        new_meta, new_body = _parse_frontmatter(content)

        # Merge metadata (new overrides old)
        merged_meta = {**old_meta, **new_meta}
        merged_meta["last_updated"] = _today()

        # Merge tags if both have them
        if "tags" in old_meta and "tags" in new_meta:
            old_tags = old_meta["tags"] if isinstance(old_meta["tags"], list) else [old_meta["tags"]]
            new_tags = new_meta["tags"] if isinstance(new_meta["tags"], list) else [new_meta["tags"]]
            merged_meta["tags"] = list(dict.fromkeys(old_tags + new_tags))  # dedupe, preserve order

        # Append body with timestamp
        if new_body.strip():
            merged_body = f"{old_body}\n\n### Update ({_now()})\n\n{new_body}"
        else:
            merged_body = old_body

        self._write_file(filepath, merged_meta, merged_body)
        return f"Memory updated: {key}"

    def list_memories(self, category: str = "") -> str:
        """List stored memories.

        Args:
            category: Optional filter - 'contacts' or 'threads'. Empty for all.

        Returns:
            Formatted list of memory keys grouped by category
        """
        if category:
            # Map singular to directory name
            dirname = CATEGORIES.get(category, category)
            if dirname not in CATEGORIES.values() and dirname != "":
                return f"Unknown category: {category}. Use: contacts, threads"
            cat_path = os.path.join(self.memory_dir, dirname)
            keys = self._list_keys_in(cat_path)
            if not keys:
                return f"No memories in {dirname}/"
            output = [f"{dirname}/ ({len(keys)}):"]
            for i, key in enumerate(keys, 1):
                summary = self._key_summary(cat_path, key)
                output.append(f"  {i}. {key}{summary}")
            return "\n".join(output)

        # List all categories
        output = []
        total = 0
        for dirname in CATEGORIES.values():
            cat_path = os.path.join(self.memory_dir, dirname)
            keys = self._list_keys_in(cat_path)
            if keys:
                total += len(keys)
                output.append(f"\n{dirname}/ ({len(keys)}):")
                for i, key in enumerate(keys, 1):
                    summary = self._key_summary(cat_path, key)
                    output.append(f"  {i}. {key}{summary}")

        # List root-level memories (no category prefix)
        root_keys = self._list_keys_in(self.memory_dir)
        if root_keys:
            total += len(root_keys)
            output.append(f"\ngeneral ({len(root_keys)}):")
            for i, key in enumerate(root_keys, 1):
                summary = self._key_summary(self.memory_dir, key)
                output.append(f"  {i}. {key}{summary}")

        if not output:
            return "No memories stored yet"

        return f"Stored Memories ({total}):" + "\n".join(output)

    def search_memory(self, query: str) -> str:
        """Full-text search across all memory files.

        Args:
            query: Search text (case-insensitive substring match)

        Returns:
            Matching memories with context
        """
        query_lower = query.lower()
        results = []
        total = 0

        # Search in category subdirectories and root
        search_dirs = [(dirname, os.path.join(self.memory_dir, dirname)) for dirname in CATEGORIES.values()]
        search_dirs.append(("general", self.memory_dir))

        for label, cat_path in search_dirs:
            if not os.path.exists(cat_path):
                continue

            for fname in sorted(os.listdir(cat_path)):
                if not fname.endswith(".md"):
                    continue
                filepath = os.path.join(cat_path, fname)
                if not os.path.isfile(filepath):
                    continue
                with open(filepath, "r") as f:
                    content = f.read()

                # Search in both frontmatter and body
                matching_lines = []
                for line_num, line in enumerate(content.split("\n"), 1):
                    if query_lower in line.lower():
                        matching_lines.append(f"  Line {line_num}: {line.strip()}")

                if matching_lines:
                    key_name = fname.replace(".md", "")
                    total += len(matching_lines)
                    results.append(f"\n{label}/{key_name}:")
                    results.extend(matching_lines[:5])  # cap per file
                    if len(matching_lines) > 5:
                        results.append(f"  ... and {len(matching_lines) - 5} more matches")

        if not results:
            return f"No matches found for: {query}"

        output = [f"Search Results ({total} matches):"]
        output.extend(results)
        return "\n".join(output)

    def log_action(self, contact_email: str, action: str) -> str:
        """Log a timestamped interaction with a contact.

        Appends a timestamped entry to the contact's action log.
        Creates the contact file if it doesn't exist.

        Args:
            contact_email: The contact's email address
            action: What happened (e.g. 'Sent follow-up about contract')

        Returns:
            Confirmation message
        """
        key = f"contact:{contact_email}"
        category_dir, filename, clean_key = self._resolve_path(key)
        filepath = self._full_path(category_dir, filename)

        timestamp = _now()
        log_entry = f"- {timestamp}: {action}"

        existing = self._read_file(filepath)
        if existing is None:
            # Create new contact file with just the log
            metadata = {
                "email": contact_email,
                "created_at": _today(),
                "last_updated": _today(),
            }
            body = f"## Action Log\n\n{log_entry}\n"
            self._write_file(filepath, metadata, body)
            return f"Action logged for {contact_email} (new contact created)"

        metadata, body = existing
        metadata["last_updated"] = _today()

        # Append to action log section, or create it
        if "## Action Log" in body:
            body = body.replace("## Action Log\n", f"## Action Log\n\n{log_entry}", 1)
        else:
            body = f"{body}\n\n## Action Log\n\n{log_entry}\n"

        self._write_file(filepath, metadata, body)
        return f"Action logged for {contact_email}: {action}"

    # --- Internal helpers ---

    def _list_keys_in(self, dir_path: str) -> list[str]:
        """List memory keys in a directory."""
        if not os.path.exists(dir_path):
            return []
        return sorted(
            f.replace(".md", "")
            for f in os.listdir(dir_path)
            if f.endswith(".md")
        )

    def _key_summary(self, cat_path: str, key: str) -> str:
        """Get a brief summary string for a key (from frontmatter)."""
        filepath = os.path.join(cat_path, f"{key}.md")
        result = self._read_file(filepath)
        if result is None:
            return ""
        metadata, _ = result
        parts = []
        for field in ("name", "company", "priority", "relationship"):
            if field in metadata:
                parts.append(str(metadata[field]))
        if parts:
            return f" ({', '.join(parts)})"
        return ""
