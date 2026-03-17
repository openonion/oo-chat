"""Tests for do_events and _get_calendar_tool functions."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch


class TestGetCalendarTool:
    """Tests for _get_calendar_tool helper."""

    @patch('cli.core.agent')
    def test_returns_google_calendar_when_available(self, mock_agent):
        """Verify Google Calendar tool is returned when linked."""
        mock_cal = Mock()
        mock_agent.tools.googlecalendar = mock_cal

        from cli.core import _get_calendar_tool
        result = _get_calendar_tool()

        assert result == mock_cal

    @patch('cli.core.agent')
    def test_returns_microsoft_calendar_when_available(self, mock_agent):
        """Verify Microsoft Calendar tool is returned when Google is not present."""
        del mock_agent.tools.googlecalendar
        mock_cal = Mock()
        mock_agent.tools.microsoftcalendar = mock_cal

        from cli.core import _get_calendar_tool
        result = _get_calendar_tool()

        assert result == mock_cal

    @patch('cli.core.agent')
    def test_returns_none_when_no_calendar_linked(self, mock_agent):
        """Verify None is returned when no calendar tool exists."""
        mock_agent.tools = Mock(spec=[])  # no attributes

        from cli.core import _get_calendar_tool
        result = _get_calendar_tool()

        assert result is None


class TestDoEvents:
    """Tests for do_events function."""

    @patch('cli.core._get_email_tool')
    def test_returns_error_when_no_email_linked(self, mock_get_email):
        """Verify error when no email provider is linked."""
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
        """Verify the search query includes date/time pattern terms."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{days}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        query = mock_email.search_emails.call_args.kwargs['query']
        assert "Monday" in query
        assert "January" in query
        assert "tomorrow" in query
        assert "after:" in query

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_search_query_uses_correct_date_range(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify after: date in query matches the days parameter."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{days}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(days=14)

        query = mock_email.search_emails.call_args.kwargs['query']
        expected_date = (datetime.now() - timedelta(days=14)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_default_days_is_7(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify default lookback window is 7 days."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{days}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        query = mock_email.search_emails.call_args.kwargs['query']
        expected_date = (datetime.now() - timedelta(days=7)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_single_search_call(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify only one search_emails call is made (combined query, no duplicates)."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{days}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        assert mock_email.search_emails.call_count == 1

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_replaces_emails_placeholder(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify {emails} placeholder is replaced with search results."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "email data"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        prompt_sent = mock_agent.input.call_args[0][0]
        assert "email data" in prompt_sent
        assert "{emails}" not in prompt_sent

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_replaces_days_placeholder(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify {days} placeholder is replaced with the days value."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{days}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "results"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(days=21)

        prompt_sent = mock_agent.input.call_args[0][0]
        assert "21" in prompt_sent
        assert "{days}" not in prompt_sent

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_handles_empty_search_results(self, mock_cmd_class, mock_agent, mock_get_email):
        """Verify None search results fall back to 'No emails found.' in the prompt."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = None
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events()

        prompt_sent = mock_agent.input.call_args[0][0]
        assert "No emails found." in prompt_sent

    @patch('cli.core._get_calendar_tool')
    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_fetches_calendar_when_unconfirmed(self, mock_cmd_class, mock_agent, mock_get_email, mock_get_cal):
        """Verify calendar events are fetched when unconfirmed=True."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cal = Mock()
        mock_get_cal.return_value = mock_cal
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{days}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_cal.list_events.return_value = "existing events"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(unconfirmed=True)

        mock_get_cal.assert_called_once()
        mock_cal.list_events.assert_called_once()

    @patch('cli.core._get_calendar_tool')
    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_existing_events_in_prompt_when_unconfirmed(self, mock_cmd_class, mock_agent, mock_get_email, mock_get_cal):
        """Verify existing calendar events appear in the prompt when unconfirmed=True."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cal = Mock()
        mock_get_cal.return_value = mock_cal
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{days}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_cal.list_events.return_value = "existing events"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(unconfirmed=True)

        prompt_sent = mock_agent.input.call_args[0][0]
        assert "existing events" in prompt_sent
        assert "true" in prompt_sent

    @patch('cli.core._get_calendar_tool')
    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    def test_skips_calendar_fetch_when_not_unconfirmed(self, mock_cmd_class, mock_agent, mock_get_email, mock_get_cal):
        """Verify calendar is not queried when unconfirmed=False."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}{days}{existing_events}{unconfirmed_only}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = "response"

        from cli.core import do_events
        do_events(unconfirmed=False)

        mock_get_cal.assert_not_called()


@pytest.mark.real_api
class TestEventsIntegration:
    """Integration tests requiring real API access.

    Run with: pytest tests/ -m real_api
    """

    def test_events_returns_result(self):
        """Verify do_events returns a non-empty string."""
        import httpx
        from cli.core import do_events

        pytest.importorskip("dotenv")
        try:
            result = do_events(days=7)
        except httpx.ReadTimeout:
            pytest.skip("Network timeout — Gmail auth backend unreachable")

        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    def test_events_unconfirmed_returns_result(self):
        """Verify do_events with unconfirmed=True runs without error."""
        import httpx
        from cli.core import do_events

        try:
            result = do_events(days=7, unconfirmed=True)
        except httpx.ReadTimeout:
            pytest.skip("Network timeout — Gmail auth backend unreachable")

        assert result is not None
        assert isinstance(result, str)
