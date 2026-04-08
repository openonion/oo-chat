"""Test the Email Agent functionality."""

import os
import shutil
import pytest
from dotenv import load_dotenv

# Load .env for tests
load_dotenv()

from memory import Memory


def test_agent_creation():
    """Test that agent is created with correct configuration."""
    # Set env var before importing agent
    os.environ['LINKED_GMAIL'] = 'true'

    # Force reimport
    import importlib
    import agent as agent_module
    importlib.reload(agent_module)

    assert agent_module.agent.name == "email-agent"
    assert agent_module.agent.max_iterations == 15


def test_agent_has_email_tools_when_gmail_linked():
    """Test that agent has access to email tools when Gmail is linked."""
    os.environ['LINKED_GMAIL'] = 'true'

    import importlib
    import agent as agent_module
    importlib.reload(agent_module)

    tool_names = [tool.name for tool in agent_module.agent.tools]

    assert "read_inbox" in tool_names
    assert "search_emails" in tool_names
    assert "send" in tool_names
    assert "mark_read" in tool_names


def test_agent_no_email_tools_when_not_linked():
    """Test that agent has no email tools when nothing is linked."""
    os.environ.pop('LINKED_GMAIL', None)
    os.environ.pop('LINKED_OUTLOOK', None)

    import importlib
    import agent as agent_module
    importlib.reload(agent_module)

    assert not hasattr(agent_module.agent.tools, 'gmail')
    assert not hasattr(agent_module.agent.tools, 'outlook')


def test_agent_has_memory_tools():
    """Test that agent has access to memory tools."""
    os.environ['LINKED_GMAIL'] = 'true'

    import importlib
    import agent as agent_module
    importlib.reload(agent_module)

    tool_names = [tool.name for tool in agent_module.agent.tools]

    assert "write_memory" in tool_names
    assert "read_memory" in tool_names
    assert "list_memories" in tool_names
    assert "search_memory" in tool_names
    assert "update_memory" in tool_names
    assert "log_action" in tool_names


def test_memory_class_integration():
    """Test that Memory class can be used as tool source."""
    memory = Memory(memory_dir="test_mem")

    assert hasattr(memory, "write_memory")
    assert hasattr(memory, "read_memory")
    assert hasattr(memory, "list_memories")
    assert hasattr(memory, "search_memory")
    assert hasattr(memory, "update_memory")
    assert hasattr(memory, "log_action")

    if os.path.exists("test_mem"):
        shutil.rmtree("test_mem")


@pytest.mark.real_api
def test_agent_basic_query():
    """Test agent can process a basic query (requires API key).

    Run with: pytest tests/ -m real_api
    """
    os.environ['LINKED_GMAIL'] = 'true'

    import importlib
    import agent as agent_module
    importlib.reload(agent_module)

    result = agent_module.agent.input("List my memories")
    assert result is not None
    assert isinstance(result, str)
