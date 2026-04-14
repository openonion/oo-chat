"""Contact provider for @ autocomplete in Input."""

import csv
from pathlib import Path

from connectonion.tui.dropdown import DropdownItem
from connectonion.tui.fuzzy import fuzzy_match


class ContactProvider:
    """Autocomplete provider for email contacts.

    Reads contacts from data/contacts.csv and provides fuzzy search
    with rich metadata display (name, email, company, relationship).

    Usage:
        from cli.contacts_provider import ContactProvider

        provider = ContactProvider()
        results = provider.search("dav")  # Fuzzy matches "Davis", "David", etc.
    """

    def __init__(self, contacts_file: str = "data/contacts.csv"):
        self.contacts_file = Path(contacts_file)
        self._contacts = None

    def _load_contacts(self) -> list[dict]:
        """Load contacts from CSV file."""
        if self._contacts is not None:
            return self._contacts

        self._contacts = []
        if not self.contacts_file.exists():
            return self._contacts

        with open(self.contacts_file, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                email = row.get("email", "").strip()
                name = row.get("name", "").strip()
                company = row.get("company", "").strip()
                relationship = row.get("relationship", "").strip()
                priority = row.get("priority", "").strip()
                contact_type = row.get("type", "").strip()

                if email:
                    self._contacts.append({
                        "email": email,
                        "name": name,
                        "company": company,
                        "relationship": relationship,
                        "priority": priority,
                        "type": contact_type,
                    })

        return self._contacts

    def _get_icon(self, contact: dict) -> str:
        """Get icon based on contact type."""
        contact_type = contact.get("type", "").upper()
        if contact_type == "PERSON":
            return "👤"
        elif contact_type == "SERVICE":
            return "🔧"
        elif contact_type == "NOTIFICATION":
            return "🔔"
        return "📧"

    def _build_subtitle(self, contact: dict) -> str:
        """Build subtitle from company and relationship."""
        parts = []
        if contact.get("company"):
            parts.append(contact["company"])
        if contact.get("relationship"):
            parts.append(contact["relationship"])
        return " · ".join(parts)

    def search(self, query: str) -> list[DropdownItem]:
        """Search contacts with fuzzy matching.

        Returns list of DropdownItem with rich metadata.
        """
        contacts = self._load_contacts()
        results = []

        for contact in contacts:
            email = contact["email"]
            name = contact["name"]

            # Match against both name and email
            search_text = f"{name} {email}" if name else email
            matched, score, positions = fuzzy_match(query, search_text)

            if matched:
                # Display name if available, otherwise email
                display = name if name else email

                # Priority contacts get a boost
                if contact.get("priority") == "high":
                    score += 50

                results.append(DropdownItem(
                    display=display,
                    value=email,
                    score=score,
                    positions=positions,
                    description=email if name else "",  # Show email as description if we're showing name
                    subtitle=self._build_subtitle(contact),
                    icon=self._get_icon(contact),
                ))

        # Sort by score (highest first)
        return sorted(results, key=lambda x: -x.score)

    def to_command_items(self) -> list:
        """Convert contacts to Textual CommandItem format for autocomplete.

        Returns list of CommandItem (DropdownItem from textual-autocomplete).
        Uses main for display (name - email), id for inserted value (@email).
        """
        from connectonion.tui import CommandItem

        contacts = self._load_contacts()
        items = []

        for contact in contacts:
            email = contact["email"]
            name = contact.get("name", "")

            # Display: name - email (or just email if no name)
            display = f"{name} - {email}" if name else email

            items.append(CommandItem(
                main=display,
                prefix=self._get_icon(contact),
                id=f"@{email}",
            ))

        return items
