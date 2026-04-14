"""Tests for Email Agent CLI."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock


class TestDoToday:
    """Tests for do_today function."""

    def test_date_query_format(self):
        """Verify date query format is correct."""
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y/%m/%d')
        query = f"after:{yesterday}"

        assert query.startswith("after:")
        date_part = query.split(':', 1)[1]
        assert len(date_part.split('/')) == 3  # YYYY/MM/DD

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_calls_search_with_correct_query(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify do_today calls search_emails with yesterday's date."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Analyze: {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "email results"
        mock_agent.input.return_value = "briefing"

        from cli.core import do_today
        result = do_today()

        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y/%m/%d')
        mock_email.search_emails.assert_called_once_with(
            query=f"after:{yesterday}",
            max_results=50
        )

    @patch('cli.core._get_email_tool')
    @patch('cli.core._llm_complete')
    @patch('cli.core.SlashCommand')
    def test_replaces_emails_placeholder(self, mock_cmd_class, mock_llm_complete, mock_get_email):
        """Verify {emails} placeholder is replaced in prompt."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Analyze these: {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "test email data"
        mock_llm_complete.return_value = "result"

        from cli.core import do_today
        do_today()

        mock_llm_complete.assert_called_once_with("Analyze these: test email data")

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    def test_returns_error_when_command_not_found(self, mock_cmd_class, mock_get_email):
        """Verify error message when today command not found."""
        mock_get_email.return_value = Mock()
        mock_cmd_class.load.return_value = None

        from cli.core import do_today
        result = do_today()

        assert "not found" in result

    @patch('cli.core._get_email_tool')
    def test_returns_error_when_no_email_linked(self, mock_get_email):
        """Verify error when no email provider linked."""
        mock_get_email.return_value = None

        from cli.core import do_today
        result = do_today()

        assert "No email account connected" in result


class TestDoInbox:
    """Tests for do_inbox function."""

    @patch('cli.core._get_email_tool')
    def test_calls_read_inbox_with_defaults(self, mock_get_email):
        """Verify do_inbox calls read_inbox with default parameters."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.read_inbox.return_value = "inbox emails"

        from cli.core import do_inbox
        result = do_inbox()

        mock_email.read_inbox.assert_called_once_with(last=10, unread=False)
        assert result == "inbox emails"

    @patch('cli.core._get_email_tool')
    def test_passes_custom_count(self, mock_get_email):
        """Verify custom count is passed to read_inbox."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.read_inbox.return_value = "emails"

        from cli.core import do_inbox
        do_inbox(count=25)

        mock_email.read_inbox.assert_called_once_with(last=25, unread=False)

    @patch('cli.core._get_email_tool')
    def test_passes_unread_filter(self, mock_get_email):
        """Verify unread filter is passed to read_inbox."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.read_inbox.return_value = "unread emails"

        from cli.core import do_inbox
        do_inbox(unread=True)

        mock_email.read_inbox.assert_called_once_with(last=10, unread=True)

    @patch('cli.core._get_email_tool')
    def test_returns_error_when_no_email_linked(self, mock_get_email):
        """Verify error when no email provider linked."""
        mock_get_email.return_value = None

        from cli.core import do_inbox
        result = do_inbox()

        assert "No email account connected" in result


class TestDoSearch:
    """Tests for do_search function."""

    @patch('cli.core._get_email_tool')
    def test_calls_search_emails(self, mock_get_email):
        """Verify do_search calls search_emails correctly."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "search results"

        from cli.core import do_search
        result = do_search(query="from:test@example.com")

        mock_email.search_emails.assert_called_once_with(
            query="from:test@example.com",
            max_results=10
        )
        assert result == "search results"

    @patch('cli.core._get_email_tool')
    def test_passes_custom_count(self, mock_get_email):
        """Verify custom count is passed to search_emails."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"

        from cli.core import do_search
        do_search(query="subject:test", count=50)

        mock_email.search_emails.assert_called_once_with(
            query="subject:test",
            max_results=50
        )


class TestDoAsk:
    """Tests for do_ask function."""

    @patch('cli.core.agent')
    def test_passes_question_to_agent(self, mock_agent):
        """Verify do_ask passes question to agent.input."""
        mock_agent.input.return_value = "agent response"

        from cli.core import do_ask
        result = do_ask("What emails need my attention?")

        mock_agent.input.assert_called_once_with("What emails need my attention?")
        assert result == "agent response"


class TestDoIdentity:
    """Tests for do_identity function."""

    @patch('cli.core._get_email_tool')
    def test_returns_identity_without_detect(self, mock_get_email):
        """Verify do_identity calls get_my_identity by default."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.get_my_identity.return_value = "user@example.com"

        from cli.core import do_identity
        result = do_identity()

        mock_email.get_my_identity.assert_called_once()
        assert result == "user@example.com"

    @patch('cli.core._get_email_tool')
    def test_detects_all_emails_when_flag_set(self, mock_get_email):
        """Verify do_identity calls detect_all_my_emails when detect=True."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.detect_all_my_emails.return_value = "all emails"

        from cli.core import do_identity
        result = do_identity(detect=True)

        mock_email.detect_all_my_emails.assert_called_once_with(max_emails=100)
        assert result == "all emails"


class TestDoUnanswered:
    """Tests for do_unanswered function."""

    @patch('cli.core._get_email_tool')
    def test_calls_with_defaults(self, mock_get_email):
        """Verify do_unanswered calls with default parameters."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.get_unanswered_emails.return_value = "unanswered"

        from cli.core import do_unanswered
        result = do_unanswered()

        mock_email.get_unanswered_emails.assert_called_once_with(
            within_days=120,
            max_results=20
        )

    @patch('cli.core._get_email_tool')
    def test_passes_custom_parameters(self, mock_get_email):
        """Verify custom parameters are passed correctly."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.get_unanswered_emails.return_value = "emails"

        from cli.core import do_unanswered
        do_unanswered(days=30, count=50)

        mock_email.get_unanswered_emails.assert_called_once_with(
            within_days=30,
            max_results=50
        )


class TestDoEvents:
    """Tests for do_events function."""

    @patch('cli.core._get_email_tool')
    def test_returns_error_when_no_email_linked(self, mock_get_email):
        """Verify error tuple when no email provider linked."""
        mock_get_email.return_value = None

        from cli.core import do_events
        display_text, events = do_events()

        assert "No email account connected" in display_text
        assert events == []

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_search_query_contains_event_keywords(self, mock_get_email, mock_llm):
        """Verify search query includes key event-related terms."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        query = mock_email.search_emails.call_args.kwargs['query']
        assert "meeting" in query
        assert "invite" in query
        assert "deadline" in query

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_search_query_uses_correct_date_range(self, mock_get_email, mock_llm):
        """Verify after: date in query matches the days parameter."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events(days=14)

        query = mock_email.search_emails.call_args.kwargs['query']
        expected_date = (datetime.now() - timedelta(days=14)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_default_days_is_7(self, mock_get_email, mock_llm):
        """Verify default lookback is 7 days."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        query = mock_email.search_emails.call_args.kwargs['query']
        expected_date = (datetime.now() - timedelta(days=7)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_handles_empty_search_results(self, mock_get_email, mock_llm):
        """Verify graceful handling when search returns None."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = None
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        prompt_sent = mock_llm.call_args[0][0]
        assert "No emails found" in prompt_sent

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_single_search_call(self, mock_get_email, mock_llm):
        """Verify only one search_emails call is made (combined query, no duplicates)."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        assert mock_email.search_emails.call_count == 1

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_returns_tuple(self, mock_get_email, mock_llm):
        """Verify do_events always returns (display_text, events_list)."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        result = do_events()

        assert isinstance(result, tuple) and len(result) == 2
        display_text, events = result
        assert isinstance(display_text, str)
        assert isinstance(events, list)

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_no_events_found_message(self, mock_get_email, mock_llm):
        """Verify message when LLM finds no events."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "some emails"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        display_text, events = do_events(days=5)

        assert "No upcoming events found" in display_text
        assert "5" in display_text
        assert events == []

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_returns_events_when_found(self, mock_get_email, mock_llm):
        """Verify events list and display text are returned when LLM finds events."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "emails with meeting info"
        mock_llm.return_value = '[{"title": "Team Standup", "date": "2026-04-10", "start_time": "09:00", "end_time": "09:30", "location": null, "attendees": null, "is_video_call": false, "source": "Alice"}]'

        from cli.core import do_events
        display_text, events = do_events()

        assert len(events) == 1
        assert events[0]['title'] == "Team Standup"
        assert "Team Standup" in display_text
        assert "add 1" in display_text

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_handles_invalid_json_from_llm(self, mock_get_email, mock_llm):
        """Verify graceful handling when LLM returns malformed JSON."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "not valid json at all"

        from cli.core import do_events
        display_text, events = do_events()

        assert "Could not parse" in display_text
        assert events == []

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_strips_markdown_fences_from_llm_response(self, mock_get_email, mock_llm):
        """Verify JSON wrapped in markdown code fences is handled correctly."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "```json\n[]\n```"

        from cli.core import do_events
        display_text, events = do_events()

        assert events == []


@pytest.mark.real_api
class TestIntegration:
    """Integration tests requiring real API access.

    Run with: pytest tests/ -m real_api
    """

    def test_today_command_returns_result(self):
        """Verify /today returns a non-empty result."""
        from cli.core import do_today
        result = do_today()

        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    def test_inbox_returns_emails(self):
        """Verify inbox returns email data."""
        from cli.core import do_inbox
        result = do_inbox(count=5)

        assert result is not None
        assert isinstance(result, str)

    def test_events_returns_result(self):
        """Verify /events returns a non-empty tuple with display text and events list."""
        from cli.core import do_events
        display_text, events = do_events(days=7)

        assert display_text is not None
        assert isinstance(display_text, str)
        assert len(display_text) > 0
        assert isinstance(events, list)

    def test_events_unconfirmed_returns_result(self):
        """Verify /events runs without error."""
        from cli.core import do_events
        display_text, events = do_events(days=7)

        assert display_text is not None
        assert isinstance(display_text, str)


class TestSetEnvFlag:
    """Tests for _set_env_flag helper function."""

    def test_creates_new_flag(self, tmp_path):
        """Verify _set_env_flag creates new flag in .env."""
        import os
        original_cwd = os.getcwd()
        os.chdir(tmp_path)

        from cli.interactive import _set_env_flag
        _set_env_flag('TEST_FLAG', 'true')

        env_content = (tmp_path / '.env').read_text()
        assert 'TEST_FLAG=true' in env_content

        os.chdir(original_cwd)

    def test_updates_existing_flag(self, tmp_path):
        """Verify _set_env_flag updates existing flag."""
        import os
        original_cwd = os.getcwd()
        os.chdir(tmp_path)

        # Create initial .env
        (tmp_path / '.env').write_text('TEST_FLAG=false\nOTHER=value\n')

        from cli.interactive import _set_env_flag
        _set_env_flag('TEST_FLAG', 'true')

        env_content = (tmp_path / '.env').read_text()
        assert 'TEST_FLAG=true' in env_content
        assert 'TEST_FLAG=false' not in env_content
        assert 'OTHER=value' in env_content

        os.chdir(original_cwd)

    def test_preserves_other_content(self, tmp_path):
        """Verify _set_env_flag preserves other .env content."""
        import os
        original_cwd = os.getcwd()
        os.chdir(tmp_path)

        # Create initial .env with existing content
        (tmp_path / '.env').write_text('API_KEY=secret\nDEBUG=true\n')

        from cli.interactive import _set_env_flag
        _set_env_flag('LINKED_GMAIL', 'true')

        env_content = (tmp_path / '.env').read_text()
        assert 'API_KEY=secret' in env_content
        assert 'DEBUG=true' in env_content
        assert 'LINKED_GMAIL=true' in env_content

        os.chdir(original_cwd)


class TestLinkCommands:
    """Tests for /link-gmail and /link-outlook command handlers."""

    def test_link_gmail_command_in_commands_list(self):
        """Verify /link-gmail is in the commands list."""
        from cli.interactive import COMMANDS

        command_names = [cmd.id for cmd in COMMANDS]
        assert '/link-gmail' in command_names

    def test_link_outlook_command_in_commands_list(self):
        """Verify /link-outlook is in the commands list."""
        from cli.interactive import COMMANDS

        command_names = [cmd.id for cmd in COMMANDS]
        assert '/link-outlook' in command_names

    def test_link_gmail_has_description(self):
        """Verify /link-gmail has proper description."""
        from cli.interactive import COMMANDS

        for cmd in COMMANDS:
            if cmd.id == '/link-gmail':
                assert 'Gmail' in str(cmd.main) or 'Connect' in str(cmd.main)
                break

    def test_link_outlook_has_description(self):
        """Verify /link-outlook has proper description."""
        from cli.interactive import COMMANDS

        for cmd in COMMANDS:
            if cmd.id == '/link-outlook':
                assert 'Outlook' in str(cmd.main) or 'Connect' in str(cmd.main)
                break


class TestProviderSelection:
    """Tests for Gmail/Outlook provider selection in agent."""

    def test_gmail_selected_when_linked(self):
        """Verify Gmail tools loaded when LINKED_GMAIL=true."""
        import os
        os.environ['LINKED_GMAIL'] = 'true'
        os.environ.pop('LINKED_OUTLOOK', None)

        import importlib
        import agent as agent_module
        importlib.reload(agent_module)

        tool_names = [t.name for t in agent_module.agent.tools]
        assert 'read_inbox' in tool_names
        assert agent_module.system_prompt == 'prompts/gmail_agent.md'

    def test_outlook_selected_when_linked(self):
        """Verify Outlook tools loaded when LINKED_OUTLOOK=true."""
        import os
        os.environ.pop('LINKED_GMAIL', None)
        os.environ['LINKED_OUTLOOK'] = 'true'

        # ToolRegistry rejects two instances with the same class name, so give
        # each mock a distinct spec class to avoid "Duplicate instance: 'mock'".
        class FakeOutlook:
            pass

        class FakeCalendar:
            pass

        import importlib
        import agent as agent_module
        with patch('connectonion.Outlook') as mock_outlook_class, \
             patch('connectonion.MicrosoftCalendar') as mock_cal_class:
            mock_outlook_class.return_value = FakeOutlook()
            mock_cal_class.return_value = FakeCalendar()
            importlib.reload(agent_module)

        assert agent_module.system_prompt == 'prompts/outlook_agent.md'

    def test_gmail_preferred_when_both_linked(self):
        """Verify Gmail preferred when both are linked."""
        import os
        os.environ['LINKED_GMAIL'] = 'true'
        os.environ['LINKED_OUTLOOK'] = 'true'

        import importlib
        import agent as agent_module
        importlib.reload(agent_module)

        # Should only have Gmail (not both, to avoid duplicate tool names)
        tool_names = [t.name for t in agent_module.agent.tools]
        assert 'read_inbox' in tool_names

    def test_no_tools_when_nothing_linked(self):
        """Verify no email tools when nothing linked."""
        import os
        os.environ.pop('LINKED_GMAIL', None)
        os.environ.pop('LINKED_OUTLOOK', None)

        import importlib
        import agent as agent_module
        importlib.reload(agent_module)

        assert not hasattr(agent_module.agent.tools, 'gmail')
        assert not hasattr(agent_module.agent.tools, 'outlook')
