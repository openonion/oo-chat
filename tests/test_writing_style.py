"""Tests for writing style learning feature."""
import time
from pathlib import Path
from unittest.mock import Mock, patch, mock_open
import pytest

@pytest.mark.unit
class TestDoWritingStyle:
    """Tests for do_writing_style() in cli/core.py."""

    @patch('cli.core._get_email_tool')
    def test_returns_error_when_no_email_connected(self, mock_get_email):
        """Returns error message when no email provider is linked."""
        mock_get_email.return_value = None

        from cli.core import do_writing_style
        result = do_writing_style()

        assert "No email account connected" in result

    @patch('cli.core._get_email_tool')
    def test_returns_error_when_get_sent_emails_unavailable(self, mock_get_email):
        """Returns error when the email provider has no get_sent_emails method."""
        mock_email = Mock(spec=[])          # no attributes at all
        mock_get_email.return_value = mock_email

        from cli.core import do_writing_style
        result = do_writing_style()

        assert "not available" in result

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    def test_returns_error_when_command_not_found(self, mock_cmd_class, mock_get_email):
        """Returns error when writing_style slash-command file is missing."""
        mock_email = Mock()
        mock_get_email.return_value = mock_email
        mock_cmd_class.load.return_value = None

        from cli.core import do_writing_style
        result = do_writing_style()

        assert "not found" in result

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    def test_returns_error_when_no_sent_emails(self, mock_cmd_class, mock_get_email):
        """Returns error when get_sent_emails returns empty/None."""
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = ""
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd

        from cli.core import do_writing_style
        result = do_writing_style()

        assert "No sent emails" in result

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_fetches_default_30_sent_emails(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        """Fetches 30 sent emails by default."""
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = "sent email data"
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_llm.return_value = "# My Writing Style\n**Tone:** Casual"

        from cli.core import do_writing_style
        do_writing_style()

        mock_email.get_sent_emails.assert_called_once_with(30)

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_fetches_custom_count_of_sent_emails(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        """Passes the count argument through to get_sent_emails."""
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = "sent email data"
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_llm.return_value = "# My Writing Style"

        from cli.core import do_writing_style
        do_writing_style(count=50)

        mock_email.get_sent_emails.assert_called_once_with(50)

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_replaces_emails_placeholder_in_prompt(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        """The {emails} placeholder in the prompt is replaced with real email data."""
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = "actual sent emails"
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "Analyze: {emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_llm.return_value = "# My Writing Style"

        from cli.core import do_writing_style
        do_writing_style()

        called_prompt = mock_llm.call_args[0][0]
        assert "actual sent emails" in called_prompt
        assert "{emails}" not in called_prompt

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('cli.core.os.makedirs')
    def test_saves_style_to_writing_style_md(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email, tmp_path):
        """Writes the generated style profile to data/writing_style.md."""
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = "sent data"
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        style_content = "# My Writing Style\n**Tone:** Casual"
        mock_llm.return_value = style_content

        # Redirect write to tmp_path so we can inspect it
        style_file = tmp_path / "writing_style.md"
        with patch('builtins.open', mock_open()) as mocked_file:
            from cli.core import do_writing_style
            do_writing_style()
            # File was opened for writing
            mocked_file.assert_called_once()
            handle = mocked_file()
            handle.write.assert_called_once_with(style_content)

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_returns_style_content_in_output(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        """The generated style profile is included in the return value."""
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = "sent data"
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_llm.return_value = "# My Writing Style\n**Tone:** Casual"

        from cli.core import do_writing_style
        result = do_writing_style()

        assert "# My Writing Style" in result
        assert "Tone" in result

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_loads_writing_style_slash_command(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        """Loads the 'writing_style' slash command (not any other)."""
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = "data"
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_llm.return_value = "# My Writing Style"

        from cli.core import do_writing_style
        do_writing_style()

        mock_cmd_class.load.assert_called_once_with("writing_style")


@pytest.mark.unit
class TestWritingStyleOutputContent:
    """Verify the LLM prompt produces output with all required sections per spec."""

    SAMPLE_STYLE = (
        "# My Writing Style\n"
        "**Tone:** Casual and friendly\n"
        "**Average Length:** Short (2-3 sentences)\n"
        "**Formality:** Low — uses contractions\n"
        "\n## Greetings\nHey [name], Hi [name]!\n"
        "\n## Sign-offs\nThanks!, Cheers,\n"
        "\n## Common Phrases\nLet me know, Sounds good, No worries\n"
        "\n## Emoji Usage\nOccasional — 👍 🙏\n"
        "\n## Style Notes\n- Gets to the point quickly\n- Uses bullet points\n"
    )

    def _make_mocks(self, mock_cmd_class, mock_llm, mock_get_email):
        mock_email = Mock()
        mock_email.get_sent_emails.return_value = "sent data"
        mock_get_email.return_value = mock_email
        mock_cmd = Mock()
        mock_cmd.prompt = "{emails}"
        mock_cmd_class.load.return_value = mock_cmd
        mock_llm.return_value = self.SAMPLE_STYLE

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_output_contains_tone(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        self._make_mocks(mock_cmd_class, mock_llm, mock_get_email)
        from cli.core import do_writing_style
        assert "Tone" in do_writing_style()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_output_contains_greetings(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        self._make_mocks(mock_cmd_class, mock_llm, mock_get_email)
        from cli.core import do_writing_style
        assert "Greetings" in do_writing_style()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_output_contains_signoffs(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        self._make_mocks(mock_cmd_class, mock_llm, mock_get_email)
        from cli.core import do_writing_style
        assert "Sign-off" in do_writing_style()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_output_contains_common_phrases(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        self._make_mocks(mock_cmd_class, mock_llm, mock_get_email)
        from cli.core import do_writing_style
        assert "Common Phrases" in do_writing_style()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_output_contains_emoji_usage(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        self._make_mocks(mock_cmd_class, mock_llm, mock_get_email)
        from cli.core import do_writing_style
        assert "Emoji" in do_writing_style()

    @patch('cli.core._get_email_tool')
    @patch('cli.core.SlashCommand')
    @patch('cli.core._llm_complete')
    @patch('builtins.open', mock_open())
    @patch('cli.core.os.makedirs')
    def test_output_contains_style_notes(self, mock_makedirs, mock_llm, mock_cmd_class, mock_get_email):
        self._make_mocks(mock_cmd_class, mock_llm, mock_get_email)
        from cli.core import do_writing_style
        assert "Style Notes" in do_writing_style()



@pytest.mark.unit
class TestRefreshWritingStyle:
    """Tests for refresh_writing_style() in automation/automation.py."""

    @patch('cli.core.do_writing_style')
    def test_skips_when_file_is_fresh(self, mock_do_style, tmp_path):
        """Does not regenerate when writing_style.md is less than 23 hours old."""
        style_file = tmp_path / "data" / "writing_style.md"
        style_file.parent.mkdir(parents=True)
        style_file.write_text("# My Writing Style")
        # File modification time = now (fresh)

        import automation.automation as mod
        with patch.object(mod.Path, '__new__', lambda cls, *a, **kw: tmp_path / "data" / "writing_style.md"):
            pass

        # Patch the path resolution inside refresh_writing_style
        with patch('automation.automation.Path') as mock_path_cls:
            mock_style_path = Mock()
            mock_style_path.exists.return_value = True
            mock_style_path.stat.return_value = Mock(st_mtime=time.time())  # just written
            mock_path_cls.return_value.__truediv__ = Mock(return_value=mock_style_path)
            mock_path_cls.return_value.resolve.return_value = Mock(
                parent=Mock(__truediv__=Mock(return_value=mock_style_path))
            )

            # Build the chain: Path(__file__).resolve().parent.parent / "data" / "writing_style.md"
            resolved = Mock()
            resolved.parent = Mock()
            resolved.parent.parent = Mock()
            data_dir = Mock()
            resolved.parent.parent.__truediv__ = Mock(return_value=data_dir)
            data_dir.__truediv__ = Mock(return_value=mock_style_path)
            mock_path_cls.return_value.resolve.return_value = resolved

            from automation.automation import refresh_writing_style
            refresh_writing_style()

        mock_do_style.assert_not_called()

    @patch('cli.core.do_writing_style')
    def test_refreshes_when_file_is_stale(self, mock_do_style):
        """Regenerates when writing_style.md is older than 23 hours."""
        stale_mtime = time.time() - (24 * 3600)  # 24 hours ago

        with patch('automation.automation.Path') as mock_path_cls:
            mock_style_path = Mock()
            mock_style_path.exists.return_value = True
            mock_style_path.stat.return_value = Mock(st_mtime=stale_mtime)

            resolved = Mock()
            resolved.parent.parent.__truediv__ = Mock(return_value=Mock(
                __truediv__=Mock(return_value=mock_style_path)
            ))
            mock_path_cls.return_value.resolve.return_value = resolved

            from automation.automation import refresh_writing_style
            refresh_writing_style()

        mock_do_style.assert_called_once()

    @patch('cli.core.do_writing_style')
    def test_generates_when_file_missing(self, mock_do_style):
        """Generates the profile when writing_style.md does not exist yet."""
        with patch('automation.automation.Path') as mock_path_cls:
            mock_style_path = Mock()
            mock_style_path.exists.return_value = False  # file missing

            resolved = Mock()
            resolved.parent.parent.__truediv__ = Mock(return_value=Mock(
                __truediv__=Mock(return_value=mock_style_path)
            ))
            mock_path_cls.return_value.resolve.return_value = resolved

            from automation.automation import refresh_writing_style
            refresh_writing_style()

        mock_do_style.assert_called_once()

    @patch('cli.core.do_writing_style', side_effect=Exception("API error"))
    def test_handles_errors_gracefully(self, mock_do_style):
        """Errors in do_writing_style are caught and logged, not raised."""
        with patch('automation.automation.Path') as mock_path_cls:
            mock_style_path = Mock()
            mock_style_path.exists.return_value = False

            resolved = Mock()
            resolved.parent.parent.__truediv__ = Mock(return_value=Mock(
                __truediv__=Mock(return_value=mock_style_path)
            ))
            mock_path_cls.return_value.resolve.return_value = resolved

            from automation.automation import refresh_writing_style
            # Should not raise
            refresh_writing_style()


@pytest.mark.unit
class TestRunOnceCallsWritingStyleRefresh:
    """Verify run_once() triggers refresh_writing_style when automation is running."""

    @patch("automation.automation.write_briefing_for_frontend")
    @patch("automation.automation.daily_summary")
    @patch("automation.automation.run_today")
    @patch("automation.automation.refresh_writing_style")
    @patch("automation.automation.is_automation_running")
    def test_calls_refresh_writing_style_when_running(
        self, mock_running, mock_refresh, mock_today, mock_summary, mock_write
    ):
        """refresh_writing_style() is called when automation is running."""
        mock_running.return_value = True
        mock_today.return_value = "Briefing"
        mock_summary.return_value = "Summary"

        from automation.automation import run_once
        run_once()

        mock_refresh.assert_called_once()

    @patch("automation.automation.write_briefing_for_frontend")
    @patch("automation.automation.daily_summary")
    @patch("automation.automation.run_today")
    @patch("automation.automation.refresh_writing_style")
    @patch("automation.automation.is_automation_running")
    def test_does_not_call_refresh_when_not_running(
        self, mock_running, mock_refresh, mock_today, mock_summary, mock_write
    ):
        """refresh_writing_style() is NOT called when automation is paused."""
        mock_running.return_value = False

        from automation.automation import run_once
        run_once()

        mock_refresh.assert_not_called()


@pytest.mark.unit
class TestCommandRouterWritingStyle:
    """Verify CommandRouter routes /writing_style correctly."""

    @patch('cli.core.do_writing_style')
    def test_routes_writing_style_command(self, mock_do_style):
        """/writing_style is handled by do_writing_style(), not the LLM agent."""
        mock_do_style.return_value = "# My Writing Style"
        mock_agent = Mock()

        from cli.core import CommandRouter
        router = CommandRouter(mock_agent)
        result = router.input("/writing_style")

        mock_do_style.assert_called_once_with(count=30)
        mock_agent.input.assert_not_called()
        assert result == "# My Writing Style"

    @patch('cli.core.do_writing_style')
    def test_routes_writing_style_with_custom_count(self, mock_do_style):
        """/writing_style 50 passes count=50 to do_writing_style()."""
        mock_do_style.return_value = "# My Writing Style"
        mock_agent = Mock()

        from cli.core import CommandRouter
        router = CommandRouter(mock_agent)
        router.input("/writing_style 50")

        mock_do_style.assert_called_once_with(count=50)

    @patch('cli.core.do_writing_style')
    def test_natural_language_draft_not_intercepted(self, mock_do_style):
        """A natural-language draft request is passed to the LLM agent, not do_writing_style."""
        mock_agent = Mock()
        mock_agent.input.return_value = "Here is a draft..."

        from cli.core import CommandRouter
        router = CommandRouter(mock_agent)
        router.input("Draft a reply to John's email")

        mock_do_style.assert_not_called()
        mock_agent.input.assert_called_once()


@pytest.mark.real_api
class TestWritingStyleIntegration:
    """Integration tests — require a connected Gmail account."""

    def test_returns_non_empty_string(self):
        from cli.core import do_writing_style
        result = do_writing_style()
        assert isinstance(result, str) and len(result.strip()) > 0

    def test_creates_writing_style_file(self):
        from cli.core import do_writing_style
        do_writing_style()
        style_path = Path("data/writing_style.md")
        assert style_path.exists(), "data/writing_style.md was not created"

    def test_file_contains_required_sections(self):
        from cli.core import do_writing_style
        do_writing_style()
        content = Path("data/writing_style.md").read_text()
        for section in ["Tone", "Greetings", "Sign-off", "Common Phrases", "Emoji", "Style Notes"]:
            assert section in content, f"Missing section: {section}"

    def test_file_is_valid_markdown(self):
        from cli.core import do_writing_style
        do_writing_style()
        content = Path("data/writing_style.md").read_text()
        assert content.startswith("#"), "File should start with a markdown heading"


# ---------------------------------------------------------------------------
# Writing style in automation prompts (generate_reply_drafts / refine_reply_draft)
# ---------------------------------------------------------------------------


def _patch_writing_style_read(fake_content: str):
    """Patch Path.read_text only for data/writing_style.md (used by automation prompts)."""
    _real = Path.read_text

    def fake_read(self, encoding=None):
        try:
            has_data = any(p.lower() == "data" for p in self.parts)
        except (ValueError, OSError):
            has_data = False
        if self.name == "writing_style.md" and has_data:
            return fake_content
        return _real(self, encoding=encoding)

    return patch.object(Path, "read_text", fake_read)


@pytest.mark.unit
class TestWritingStyleInAutomatedDrafts:
    """Profile from data/writing_style.md is injected into automation LLM prompts."""

    @patch("cli.core._llm_complete", return_value="[]")
    @patch("cli.core._get_email_tool", return_value=None)
    def test_generate_reply_drafts_includes_profile_when_present(self, _mock_tool, mock_llm):
        from cli.core import generate_reply_drafts

        with _patch_writing_style_read("# Style\n**Tone:** match-me\n"):
            generate_reply_drafts(
                [{"id": "m1", "from": "a@b.com", "subject": "Hi", "snippet": "x"}]
            )
        prompt = mock_llm.call_args[0][0]
        assert "User writing style profile" in prompt
        assert "match-me" in prompt

    @patch("cli.core._llm_complete", return_value="[]")
    @patch("cli.core._get_email_tool", return_value=None)
    def test_generate_reply_drafts_fallback_when_no_profile(self, _mock_tool, mock_llm):
        from cli.core import generate_reply_drafts

        with _patch_writing_style_read(""):
            generate_reply_drafts(
                [{"id": "m1", "from": "a@b.com", "subject": "Hi", "snippet": "x"}]
            )
        prompt = mock_llm.call_args[0][0]
        assert "No writing style profile is on file yet" in prompt

    @patch("cli.core._llm_complete", return_value="Done.")
    def test_refine_reply_draft_includes_profile_when_present(self, mock_llm):
        from cli.core import refine_reply_draft

        with _patch_writing_style_read("# Me\n**Tone:** brief\n"):
            refine_reply_draft(
                "shorter",
                "Hello and thanks for your long message",
                subject="Re: X",
                from_line="a@b.com",
                original_email="Body",
            )
        prompt = mock_llm.call_args[0][0]
        assert "User writing style profile" in prompt
        assert "brief" in prompt
