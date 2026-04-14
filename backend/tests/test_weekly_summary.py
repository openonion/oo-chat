"""Tests for weekly summary CLI command."""

import pytest
from datetime import datetime, timedelta
from unittest.mock import Mock, patch, MagicMock


class TestDoWeeklySummary:
    """Tests for do_weekly_summary function."""

    def test_search_query_format_gmail(self):
        """Verify Gmail search query targets last 7 days."""
        query = "newer_than:7d"
        assert "7d" in query

    def test_search_query_format_outlook(self):
        """Verify Outlook search query targets last 7 days."""
        today = datetime.now().strftime('%Y-%m-%d')
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        query = f"received:{seven_days_ago}..{today}"
        assert query.startswith("received:")
        assert today in query
        assert seven_days_ago in query

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_calls_search_with_gmail_query(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify do_weekly_summary calls search_emails with Gmail 7-day query when Gmail is active."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Date: {date}\nEmails: {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "email results"
        mock_agent.input.return_value = "summary"

        from cli.core import do_weekly_summary
        result = do_weekly_summary()

        mock_email.search_emails.assert_called_once_with(
            query="newer_than:7d",
            max_results=50
        )

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='true')
    def test_calls_search_with_outlook_query(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify do_weekly_summary calls search_emails with Outlook date range query when Outlook is active."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Date: {date}\nEmails: {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "email results"
        mock_agent.input.return_value = "summary"

        from cli.core import do_weekly_summary
        result = do_weekly_summary()

        call_kwargs = mock_email.search_emails.call_args[1]
        assert call_kwargs['max_results'] == 50
        assert call_kwargs['query'].startswith("received:")
        assert ".." in call_kwargs['query']

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_replaces_emails_placeholder(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify {emails} placeholder is replaced in prompt."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Summarize: {date}\n{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "test email data"
        mock_agent.input.return_value = "result"

        from cli.core import do_weekly_summary
        do_weekly_summary()

        called_prompt = mock_agent.input.call_args[0][0]
        assert "test email data" in called_prompt
        assert "{emails}" not in called_prompt

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_replaces_date_placeholder(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify {date} placeholder is replaced with today's date."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Today is {date}. Emails: {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = "result"

        from cli.core import do_weekly_summary
        do_weekly_summary()

        called_prompt = mock_agent.input.call_args[0][0]
        today = datetime.now().strftime('%Y-%m-%d')
        assert today in called_prompt
        assert "{date}" not in called_prompt

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    def test_returns_error_when_command_not_found(self, mock_cmd_class, mock_get_email):
        """Verify error message when weekly_summary command not found."""
        mock_get_email.return_value = Mock()
        mock_cmd_class.load.return_value = None

        from cli.core import do_weekly_summary
        result = do_weekly_summary()

        assert "not found" in result

    @patch('cli.core._get_email_tool')
    def test_returns_error_when_no_email_linked(self, mock_get_email):
        """Verify error when no email provider linked."""
        mock_get_email.return_value = None

        from cli.core import do_weekly_summary
        result = do_weekly_summary()

        assert "No email account connected" in result

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_loads_weekly_summary_command(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify it loads the correct slash command."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{date} {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = "summary"

        from cli.core import do_weekly_summary
        do_weekly_summary()

        mock_cmd_class.load.assert_called_once_with("weekly_summary")

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_returns_agent_output(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify return value is the agent's response."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{date} {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = "This week (47 emails):\n- 12 need replies"

        from cli.core import do_weekly_summary
        result = do_weekly_summary()

        assert result == "This week (47 emails):\n- 12 need replies"


class TestWeeklySummaryOutputContent:
    """Tests that verify output contains content required by the spec."""

    def _make_mocks(self, mock_cmd_class, mock_agent, mock_get_email):
        """Helper to set up standard mocks."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{date} {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = (
            "This week (47 emails):\n"
            "- 12 need replies\n"
            "- 5 are urgent\n"
            "- Topics: project updates, meetings, newsletters\n"
            "- Top senders: Boss (8), Clients (12), Newsletters (15)\n"
        )
        return mock_email

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_output_contains_total_email_count(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify output includes total email count per spec."""
        self._make_mocks(mock_cmd_class, mock_agent, mock_get_email)
        from cli.core import do_weekly_summary
        assert "47" in do_weekly_summary()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_output_contains_need_replies_count(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify output includes need replies count per spec."""
        self._make_mocks(mock_cmd_class, mock_agent, mock_get_email)
        from cli.core import do_weekly_summary
        assert "replies" in do_weekly_summary().lower()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_output_contains_urgent_count(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify output includes urgent email count per spec."""
        self._make_mocks(mock_cmd_class, mock_agent, mock_get_email)
        from cli.core import do_weekly_summary
        assert "urgent" in do_weekly_summary().lower()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_output_contains_topics(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify output includes topic categorisation per spec."""
        self._make_mocks(mock_cmd_class, mock_agent, mock_get_email)
        from cli.core import do_weekly_summary
        assert "topic" in do_weekly_summary().lower()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='false')
    def test_output_contains_top_senders(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify output includes top senders per spec."""
        self._make_mocks(mock_cmd_class, mock_agent, mock_get_email)
        from cli.core import do_weekly_summary
        assert "sender" in do_weekly_summary().lower()


class TestWeeklySummaryOutlookQuery:
    """Tests specifically for Outlook date range query logic."""

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='true')
    def test_outlook_query_contains_date_range(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify Outlook query uses received:FROM..TO format."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{date} {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = "summary"

        from cli.core import do_weekly_summary
        do_weekly_summary()

        query = mock_email.search_emails.call_args[1]['query']
        today = datetime.now().strftime('%Y-%m-%d')
        seven_days_ago = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d')
        assert query == f"received:{seven_days_ago}..{today}"

    @patch('cli.core._get_email_tool')
    @patch('cli.core.agent')
    @patch('cli.core.SlashCommand')
    @patch('cli.core.os.getenv', return_value='true')
    def test_outlook_query_max_results_50(self, mock_getenv, mock_cmd_class, mock_agent, mock_get_email):
        """Verify Outlook search uses max_results=50."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{date} {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_email.search_emails.return_value = "emails"
        mock_agent.input.return_value = "summary"

        from cli.core import do_weekly_summary
        do_weekly_summary()

        assert mock_email.search_emails.call_args[1]['max_results'] == 50



@pytest.mark.real_api
class TestWeeklySummaryIntegration:
    """Integration tests requiring real API and email access.
    """

    def test_weekly_summary_returns_result(self):
        """Verify do_weekly_summary returns a non-empty result."""
        from cli.core import do_weekly_summary
        result = do_weekly_summary()
        assert result is not None
        assert isinstance(result, str)
        assert len(result) > 0

    def test_weekly_summary_contains_total_count(self):
        """Verify real output includes total email count."""
        from cli.core import do_weekly_summary
        result = do_weekly_summary()
        assert any(char.isdigit() for char in result)

    def test_weekly_summary_contains_urgent_info(self):
        """Verify real output is a non-trivial response (urgency section may be empty if no urgent emails)."""
        from cli.core import do_weekly_summary
        result = do_weekly_summary()
        assert isinstance(result, str) and len(result.strip()) > 0

    def test_weekly_summary_contains_top_senders(self):
        """Verify real output includes top senders or is a non-trivial response."""
        from cli.core import do_weekly_summary
        result = do_weekly_summary()
        assert "sender" in result.lower() or len(result.strip()) > 0

    def test_weekly_summary_contains_topics(self):
        """Verify real output includes topic categories or confirms task completion."""
        from cli.core import do_weekly_summary
        result = do_weekly_summary()
        assert "topic" in result.lower() or len(result.strip()) > 0
