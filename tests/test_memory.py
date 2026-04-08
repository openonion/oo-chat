"""Test the structured markdown Memory system."""

import os
import shutil
import pytest

from memory import Memory


TEST_DIR = "test_memories_temp"


@pytest.fixture
def mem():
    """Create a Memory instance with a temp directory."""
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)
    m = Memory(memory_dir=TEST_DIR)
    yield m
    if os.path.exists(TEST_DIR):
        shutil.rmtree(TEST_DIR)


# --- Directory structure ---

def test_creates_category_dirs(mem):
    """Memory init creates contacts/ and threads/ subdirs."""
    for subdir in ("contacts", "threads"):
        assert os.path.isdir(os.path.join(TEST_DIR, subdir))


# --- write_memory / read_memory ---

def test_write_and_read_default(mem):
    result = mem.write_memory("user_style", "Casual tone, signs off with Cheers")
    assert "saved" in result.lower()
    assert "user_style" in result

    content = mem.read_memory("user_style")
    assert "Casual tone" in content
    assert "user_style" in content


def test_write_and_read_contact(mem):
    result = mem.write_memory("contact:lisa@notion.so", "Enterprise sales at Notion")
    assert "contacts/" in result

    content = mem.read_memory("contact:lisa@notion.so")
    assert "Enterprise sales" in content
    assert "lisa@notion.so" in content


def test_write_and_read_thread(mem):
    result = mem.write_memory("thread:acme-deal", "Negotiating API integration contract")
    assert "threads/" in result

    content = mem.read_memory("thread:acme-deal")
    assert "Negotiating" in content


def test_read_nonexistent(mem):
    result = mem.read_memory("contact:nobody@example.com")
    assert "not found" in result.lower()


def test_write_overwrites(mem):
    mem.write_memory("fact_key", "version 1")
    mem.write_memory("fact_key", "version 2")

    content = mem.read_memory("fact_key")
    assert "version 2" in content
    assert "version 1" not in content


def test_write_with_frontmatter_in_content(mem):
    """Agent can pass frontmatter in the content string."""
    content = """---
name: Lisa Chen
company: Notion
priority: high
tags: [client, enterprise]
---

Enterprise sales contact."""
    mem.write_memory("contact:lisa@notion.so", content)

    result = mem.read_memory("contact:lisa@notion.so")
    assert "Lisa Chen" in result
    assert "Notion" in result
    assert "Enterprise sales" in result


# --- update_memory ---

def test_update_appends(mem):
    mem.write_memory("contact:bob@acme.com", "Initial info about Bob")
    mem.update_memory("contact:bob@acme.com", "Bob got promoted to VP")

    content = mem.read_memory("contact:bob@acme.com")
    assert "Initial info" in content
    assert "promoted to VP" in content
    assert "Update (" in content  # timestamp separator


def test_update_merges_frontmatter(mem):
    mem.write_memory("contact:bob@acme.com", "---\npriority: medium\n---\n\nBob at Acme")
    mem.update_memory("contact:bob@acme.com", "---\npriority: high\ncompany: Acme Corp\n---\n\nNow VP")

    content = mem.read_memory("contact:bob@acme.com")
    assert "high" in content  # priority updated
    assert "Acme Corp" in content


def test_update_merges_tags(mem):
    mem.write_memory("contact:x@y.com", "---\ntags: [client]\n---\n\nInfo")
    mem.update_memory("contact:x@y.com", "---\ntags: [enterprise, client]\n---\n\nMore")

    # Read the raw file to check tags were deduped
    filepath = os.path.join(TEST_DIR, "contacts", "x@y.com.md")
    with open(filepath) as f:
        raw = f.read()
    assert "client" in raw
    assert "enterprise" in raw


def test_update_creates_if_new(mem):
    result = mem.update_memory("contact:new@person.com", "Brand new contact")
    assert "saved" in result.lower()

    content = mem.read_memory("contact:new@person.com")
    assert "Brand new" in content


# --- list_memories ---

def test_list_empty(mem):
    result = mem.list_memories()
    assert "no memories" in result.lower()


def test_list_all(mem):
    mem.write_memory("contact:a@b.com", "A")
    mem.write_memory("thread:deal", "B")
    mem.write_memory("note", "C")

    result = mem.list_memories()
    assert "a@b.com" in result
    assert "deal" in result
    assert "note" in result


def test_list_filtered(mem):
    mem.write_memory("contact:a@b.com", "A")
    mem.write_memory("thread:deal", "B")

    result = mem.list_memories("contacts")
    assert "a@b.com" in result
    assert "deal" not in result


def test_list_unknown_category(mem):
    result = mem.list_memories("nonexistent")
    assert "unknown category" in result.lower()


# --- search_memory ---

def test_search_finds_across_categories(mem):
    mem.write_memory("contact:lisa@notion.so", "Enterprise sales at Notion")
    mem.write_memory("thread:notion-deal", "Contract negotiation with Notion")
    mem.write_memory("crm_report", "Notion is a key account")

    result = mem.search_memory("Notion")
    assert "contacts/" in result or "lisa" in result
    assert "threads/" in result or "notion-deal" in result
    assert "general/" in result or "crm_report" in result


def test_search_case_insensitive(mem):
    mem.write_memory("note", "Important meeting with ACME")

    result = mem.search_memory("acme")
    assert "ACME" in result


def test_search_no_results(mem):
    mem.write_memory("note", "Hello world")
    result = mem.search_memory("zzzzz")
    assert "no matches" in result.lower()


# --- log_action ---

def test_log_action_existing_contact(mem):
    mem.write_memory("contact:lisa@notion.so", "Lisa at Notion")
    result = mem.log_action("lisa@notion.so", "Sent follow-up about contract")

    assert "logged" in result.lower()

    content = mem.read_memory("contact:lisa@notion.so")
    assert "Action Log" in content
    assert "Sent follow-up" in content


def test_log_action_creates_contact(mem):
    result = mem.log_action("new@person.com", "First interaction via email")

    assert "new contact created" in result.lower()

    content = mem.read_memory("contact:new@person.com")
    assert "First interaction" in content


def test_log_action_multiple(mem):
    mem.write_memory("contact:bob@acme.com", "Bob")
    mem.log_action("bob@acme.com", "Called about pricing")
    mem.log_action("bob@acme.com", "Sent proposal PDF")

    content = mem.read_memory("contact:bob@acme.com")
    assert "Called about pricing" in content
    assert "Sent proposal PDF" in content


# --- Frontmatter timestamps ---

def test_timestamps_on_write(mem):
    mem.write_memory("note", "Test")

    filepath = os.path.join(TEST_DIR, "note.md")
    with open(filepath) as f:
        raw = f.read()
    assert "created_at:" in raw
    assert "last_updated:" in raw


def test_timestamps_update_on_overwrite(mem):
    mem.write_memory("note", "v1")

    filepath = os.path.join(TEST_DIR, "note.md")
    with open(filepath) as f:
        raw1 = f.read()

    mem.write_memory("note", "v2")
    with open(filepath) as f:
        raw2 = f.read()

    assert "last_updated:" in raw2


# --- Persistence ---

def test_persistence_across_instances(mem):
    mem.write_memory("contact:x@y.com", "Persistent data")

    mem2 = Memory(memory_dir=TEST_DIR)
    content = mem2.read_memory("contact:x@y.com")
    assert "Persistent data" in content
