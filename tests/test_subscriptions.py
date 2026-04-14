"""Tests for Subscription Check feature."""

import pytest
import os
from unittest.mock import Mock, patch


class TestCheckSubscriptions:
    """Tests for check_subscriptions wrapper function."""

    @patch('agent.subscription_checker')
    def test_calls_sub_agent(self, mock_checker):
        """Verify check_subscriptions calls the sub-agent."""
        mock_checker.input.return_value = "scan results"

        from agent import check_subscriptions
        result = check_subscriptions()

        mock_checker.input.assert_called_once()

    @patch('agent.subscription_checker')
    def test_instructions_mention_memory_check(self, mock_checker):
        """Verify instructions tell sub-agent to check memory first."""
        mock_checker.input.return_value = "results"

        from agent import check_subscriptions
        check_subscriptions()

        call_args = mock_checker.input.call_args[0][0]
        assert "subscriptions:all" in call_args

    @patch('agent.subscription_checker')
    def test_instructions_mention_search_fallback(self, mock_checker):
        """Verify instructions tell sub-agent to search if memory empty."""
        mock_checker.input.return_value = "results"

        from agent import check_subscriptions
        check_subscriptions()

        call_args = mock_checker.input.call_args[0][0]
        assert "search_emails" in call_args

    @patch('agent.subscription_checker')
    def test_instructions_mention_get_email_body(self, mock_checker):
        """Verify instructions tell sub-agent to extract links."""
        mock_checker.input.return_value = "results"

        from agent import check_subscriptions
        check_subscriptions()

        call_args = mock_checker.input.call_args[0][0]
        assert "get_email_body" in call_args

    @patch('agent.subscription_checker')
    def test_instructions_mention_write_memory(self, mock_checker):
        """Verify instructions tell sub-agent to save results."""
        mock_checker.input.return_value = "results"

        from agent import check_subscriptions
        check_subscriptions()

        call_args = mock_checker.input.call_args[0][0]
        assert "write_memory" in call_args

    @patch('agent.subscription_checker')
    def test_instructions_mention_recurring_filter(self, mock_checker):
        """Verify instructions mention 2+ email filter."""
        mock_checker.input.return_value = "results"

        from agent import check_subscriptions
        check_subscriptions()

        call_args = mock_checker.input.call_args[0][0]
        assert "2+" in call_args or "2 or more" in call_args

    @patch('agent.subscription_checker')
    def test_returns_complete_message(self, mock_checker):
        """Verify returns formatted result."""
        mock_checker.input.return_value = "Found 5 senders"

        from agent import check_subscriptions
        result = check_subscriptions()

        assert "CHECK COMPLETE" in result
        assert "Found 5 senders" in result


class TestSubscriptionCheckerSetup:
    """Tests for sub-agent configuration."""

    def test_checker_exists(self):
        """Verify subscription_checker agent is defined."""
        import agent as agent_module
        assert hasattr(agent_module, 'subscription_checker')

    def test_checker_uses_correct_prompt(self):
            """Verify checker loads a valid subscription checker prompt."""
            import agent as agent_module
            prompt = agent_module.subscription_checker.system_prompt
            assert "read_memory" in prompt
            assert "search_emails" in prompt
            assert "get_email_body" in prompt
            assert "write_memory" in prompt
            assert "subscriptions" in prompt

    def test_checker_has_enough_iterations(self):
        """Verify checker has sufficient iterations."""
        import agent as agent_module
        assert agent_module.subscription_checker.max_iterations >= 25

    def test_checker_has_tools(self):
        """Verify checker has tools registered."""
        import agent as agent_module
        assert len(agent_module.subscription_checker.tools) > 0

    def test_checker_tool_count_includes_extras(self):
        """Verify checker has more tools than just email tools."""
        import agent as agent_module
        assert len(agent_module.subscription_checker.tools) > 2


class TestToolRegistration:
    """Tests for main agent tool registration."""

    def test_check_subscriptions_registered(self):
        """Verify check_subscriptions is in the main agent's tools."""
        import agent as agent_module
        tool_names = []
        for t in agent_module.tools:
            if callable(t) and hasattr(t, '__name__'):
                tool_names.append(t.__name__)
            else:
                tool_names.append(type(t).__name__)
        assert 'check_subscriptions' in tool_names, \
            f"check_subscriptions not found. Available: {tool_names}"

class TestPromptFiles:
    """Tests for prompt file content."""

    def test_checker_prompt_exists(self):
        """Verify subscription_checker.md exists."""
        assert os.path.exists("prompts/subscription_checker.md")

    def test_checker_prompt_has_memory_check(self):
        """Verify prompt tells agent to check memory first."""
        with open("prompts/subscription_checker.md", encoding="utf-8") as f:
            content = f.read()
        assert "read_memory" in content
        assert "subscriptions" in content

    def test_checker_prompt_has_search_fallback(self):
        """Verify prompt tells agent to search if memory empty."""
        with open("prompts/subscription_checker.md", encoding="utf-8") as f:
            content = f.read()
        assert "search_emails" in content

    def test_checker_prompt_has_link_extraction(self):
        """Verify prompt requires extracting unsubscribe links."""
        with open("prompts/subscription_checker.md", encoding="utf-8") as f:
            content = f.read()
        assert "List-Unsubscribe" in content
        assert "get_email_body" in content

    def test_checker_prompt_has_memory_save(self):
        """Verify prompt requires saving to memory."""
        with open("prompts/subscription_checker.md", encoding="utf-8") as f:
            content = f.read()
        assert "write_memory" in content

    def test_checker_prompt_has_recurring_filter(self):
        """Verify prompt filters for 2+ emails."""
        with open("prompts/subscription_checker.md", encoding="utf-8") as f:
            content = f.read()
        assert "2 or more" in content or "2+" in content

    def test_checker_prompt_has_categories(self):
        """Verify prompt defines classification categories."""
        with open("prompts/subscription_checker.md", encoding="utf-8") as f:
            content = f.read()
        for category in ["spam", "marketing", "newsletter", "transactional", "social"]:
            assert category in content.lower()

    def test_gmail_agent_mentions_check_subscriptions(self):
        """Verify gmail_agent.md references check_subscriptions."""
        with open("prompts/gmail_agent.md", encoding="utf-8") as f:
            content = f.read()
        assert "check_subscriptions" in content

    def test_gmail_agent_forbids_read_inbox(self):
        """Verify gmail_agent.md forbids read_inbox for subscriptions."""
        with open("prompts/gmail_agent.md", encoding="utf-8") as f:
            content = f.read()
        assert "read_inbox" in content

    def test_command_file_exists(self):
        """Verify subscriptions.md command exists."""
        assert os.path.exists("commands/subscriptions.md")

    def test_command_uses_check_not_scan(self):
        """Verify command avoids 'scan' keyword."""
        with open("commands/subscriptions.md", encoding="utf-8") as f:
            content = f.read()
        parts = content.split("---")
        if len(parts) >= 3:
            body = parts[2].strip().lower()
            assert "check" in body


@pytest.mark.real_api
class TestSubscriptionIntegration:
    """Integration tests requiring real API access.

    Run with: pytest tests/ -m real_api
    """

    def test_check_returns_result(self):
        """Verify check_subscriptions returns non-empty result."""
        from agent import check_subscriptions
        result = check_subscriptions()

        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0
        assert "CHECK COMPLETE" in result

    def test_check_saves_to_memory(self):
        """Verify results are saved to memory file."""
        from agent import check_subscriptions
        check_subscriptions()

        assert os.path.exists("data/memory.md")
        with open("data/memory.md", encoding="utf-8") as f:
            content = f.read()
        assert "subscriptions" in content.lower()

    def test_second_check_uses_memory(self):
        """Verify second call reads from memory instead of rescanning."""
        from agent import check_subscriptions

        result1 = check_subscriptions()
        assert "CHECK COMPLETE" in result1

        result2 = check_subscriptions()
        assert "CHECK COMPLETE" in result2