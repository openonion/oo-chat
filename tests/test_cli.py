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
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_replaces_emails_placeholder(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify {emails} placeholder is replaced in prompt."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Analyze these: {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "test email data"
        mock_agent.input.return_value = "result"

        from cli.core import do_today
        do_today()

        mock_agent.input.assert_called_once_with("Analyze these: test email data")

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
        """Verify error when no email provider linked."""
        mock_get_email.return_value = None

        from cli.core import do_events
        result = do_events()

        assert "No email account connected" in result

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    def test_returns_error_when_command_not_found(self, mock_cmd_class, mock_get_email):
        """Verify error when events command file is missing."""
        mock_get_email.return_value = Mock()
        mock_cmd_class.load.return_value = None

        from cli.core import do_events
        result = do_events()

        assert "not found" in result

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_search_query_contains_event_keywords(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify search query includes key event-related terms."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        call_args = mock_email.search_emails.call_args
        query = call_args.kwargs['query']
        assert "meeting" in query
        assert "invite" in query
        assert "RSVP" in query
        assert "deadline" in query

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_search_query_uses_correct_date_range(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify after: date in query matches the days parameter."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(days=14)

        call_args = mock_email.search_emails.call_args
        query = call_args.kwargs['query']
        expected_date = (datetime.now() - timedelta(days=14)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_default_days_is_7(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify default lookback is 7 days."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        call_args = mock_email.search_emails.call_args
        query = call_args.kwargs['query']
        expected_date = (datetime.now() - timedelta(days=7)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_replaces_placeholders_in_prompt(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify {emails} and {days} placeholders are replaced before calling agent."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Emails: {emails} | Days: {days} | Existing: {existing_events} | Unconfirmed: {unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "email data"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(days=3)

        prompt_sent = mock_agent.input.call_args[0][0]
        assert "email data" in prompt_sent
        assert "3" in prompt_sent
        assert "{emails}" not in prompt_sent
        assert "{days}" not in prompt_sent

    @patch('cli.core._get_calendar_tool')
    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_fetches_existing_events_when_unconfirmed(self, mock_cmd_class, mock_agent, mock_get_email, mock_get_cal):
        """Verify calendar is queried when unconfirmed=True."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cal = Mock()
        mock_get_cal.return_value = mock_cal
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_cal.list_events.return_value = "existing calendar events"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(unconfirmed=True)

        mock_get_cal.assert_called_once()
        mock_cal.list_events.assert_called_once()
        prompt_sent = mock_agent.input.call_args[0][0]
        assert "existing calendar events" in prompt_sent
        assert "true" in prompt_sent

    @patch('cli.core._get_calendar_tool')
    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_skips_calendar_fetch_when_not_unconfirmed(self, mock_cmd_class, mock_agent, mock_get_email, mock_get_cal):
        """Verify calendar is NOT queried when unconfirmed=False."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(unconfirmed=False)

        mock_get_cal.assert_not_called()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_handles_empty_search_results(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify graceful handling when search returns no emails."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = None
        mock_agent.input.return_value = "No events found"

        from cli.core import do_events
        result = do_events()

        prompt_sent = mock_agent.input.call_args[0][0]
        assert "No emails found" in prompt_sent

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_single_search_call(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify only one search_emails call is made (combined query, no duplicates)."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        assert mock_email.search_emails.call_count == 1


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
        """Verify /events returns a non-empty string."""
        from cli.core import do_events
        result = do_events(days=7)

        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    def test_events_unconfirmed_returns_result(self):
        """Verify /events --unconfirmed runs without error."""
        from cli.core import do_events
        result = do_events(days=7, unconfirmed=True)

        assert result is not None
        assert isinstance(result, str)


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

        command_names = [cmd[0] for cmd in COMMANDS]
        assert '/link-gmail' in command_names

    def test_link_outlook_command_in_commands_list(self):
        """Verify /link-outlook is in the commands list."""
        from cli.interactive import COMMANDS

        command_names = [cmd[0] for cmd in COMMANDS]
        assert '/link-outlook' in command_names

    def test_link_gmail_has_description(self):
        """Verify /link-gmail has proper description."""
        from cli.interactive import COMMANDS

        for cmd in COMMANDS:
            if cmd[0] == '/link-gmail':
                assert 'Gmail' in cmd[2] or 'Connect' in cmd[2]
                break

    def test_link_outlook_has_description(self):
        """Verify /link-outlook has proper description."""
        from cli.interactive import COMMANDS

        for cmd in COMMANDS:
            if cmd[0] == '/link-outlook':
                assert 'Outlook' in cmd[2] or 'Connect' in cmd[2]
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

        assert hasattr(agent_module.agent.tools, 'gmail')
        assert agent_module.system_prompt == 'prompts/gmail_agent.md'

    def test_outlook_selected_when_linked(self):
        """Verify Outlook tools loaded when LINKED_OUTLOOK=true."""
        import os
        os.environ.pop('LINKED_GMAIL', None)
        os.environ['LINKED_OUTLOOK'] = 'true'

        import importlib
        import agent as agent_module
        importlib.reload(agent_module)

        assert hasattr(agent_module.agent.tools, 'outlook')
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
        assert hasattr(agent_module.agent.tools, 'gmail')
        assert not hasattr(agent_module.agent.tools, 'outlook')

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