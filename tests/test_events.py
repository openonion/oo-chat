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
        text, events = do_events()

        assert "No email account connected" in text
        assert events == []

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_returns_error_when_llm_returns_invalid_json(self, mock_get_email, mock_llm):
        """Verify error message when LLM returns unparseable JSON."""
        mock_get_email.return_value = Mock()
        mock_get_email.return_value.search_emails.return_value = "some emails"
        mock_llm.return_value = "not valid json"

        from cli.core import do_events
        text, events = do_events()

        assert "Could not parse" in text
        assert events == []

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_search_query_contains_event_keywords(self, mock_get_email, mock_llm):
        """Verify the search query includes date/time pattern terms."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        query = mock_email.search_emails.call_args.kwargs['query']
        assert "Mon" in query       # abbreviated day names cover full names too
        assert "Jan" in query       # abbreviated month names cover full names too
        assert "tomorrow" in query
        assert "meeting" in query
        assert "after:" in query

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

        from zoneinfo import ZoneInfo
        query = mock_email.search_emails.call_args.kwargs['query']
        expected_date = (datetime.now(tz=ZoneInfo("Australia/Sydney")) - timedelta(days=14)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_default_days_is_7(self, mock_get_email, mock_llm):
        """Verify default lookback window is 7 days."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        from zoneinfo import ZoneInfo
        query = mock_email.search_emails.call_args.kwargs['query']
        expected_date = (datetime.now(tz=ZoneInfo("Australia/Sydney")) - timedelta(days=7)).strftime('%Y/%m/%d')
        assert f"after:{expected_date}" in query

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_single_search_call(self, mock_get_email, mock_llm):
        """Verify only one search_emails call is made."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        assert mock_email.search_emails.call_count == 1

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_returns_no_events_message_when_empty(self, mock_get_email, mock_llm):
        """Verify appropriate message when LLM finds no events."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        text, events = do_events()

        assert "No upcoming events" in text
        assert events == []

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_handles_empty_search_results(self, mock_get_email, mock_llm):
        """Verify None search results fall back to 'No emails found.' in the prompt."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = None
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events()

        prompt_sent = mock_llm.call_args[0][0]
        assert "No emails found." in prompt_sent

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_max_emails_passed_to_search(self, mock_get_email, mock_llm):
        """Verify max_emails parameter is forwarded to search_emails."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "results"
        mock_llm.return_value = "[]"

        from cli.core import do_events
        do_events(max_emails=100)

        assert mock_email.search_emails.call_args.kwargs['max_results'] == 100

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_source_field_shown_in_display(self, mock_get_email, mock_llm):
        """Verify source field from extracted event appears in display output."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "emails"
        mock_llm.return_value = '[{"title": "Team Sync", "date": "2026-04-10", "start_time": "10:00", "end_time": "11:00", "location": null, "attendees": null, "is_video_call": false, "source": "Alice — Project update"}]'

        from cli.core import do_events
        text, events = do_events()

        assert "Alice — Project update" in text

    @patch('cli.core._llm_complete')
    @patch('cli.core._get_email_tool')
    def test_returns_tuple_with_events_list(self, mock_get_email, mock_llm):
        """Verify do_events returns a tuple of (str, list)."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_email.search_emails.return_value = "emails"
        mock_llm.return_value = '[{"title": "Team Sync", "date": "2026-04-01", "start_time": "10:00", "end_time": "11:00", "location": null, "attendees": null, "is_video_call": false}]'

        from cli.core import do_events
        text, events = do_events()

        assert isinstance(text, str)
        assert isinstance(events, list)
        assert len(events) == 1
        assert events[0]["title"] == "Team Sync"
        assert "Team Sync" in text
        assert 'add all' in text


@pytest.mark.real_api
class TestEventsIntegration:
    """Integration tests requiring real API access.

    Run with: pytest tests/ -m real_api
    """

    def test_events_returns_result(self):
        """Verify do_events returns a non-empty (text, list) tuple."""
        import httpx
        from cli.core import do_events

        pytest.importorskip("dotenv")
        try:
            result = do_events(days=7)
        except httpx.ReadTimeout:
            pytest.skip("Network timeout — Gmail auth backend unreachable")

        assert result is not None
        text, events = result
        assert isinstance(text, str)
        assert len(text) > 0

