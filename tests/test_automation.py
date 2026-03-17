"""Unit tests for daily automation (automation package)."""

import json
import os
from pathlib import Path
from unittest.mock import patch

import pytest


# Import automation module for patching (path under backend/)
import sys
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))


@pytest.mark.unit
class TestIsAutomationRunning:
    """Tests for is_automation_running()."""

    def test_returns_true_when_config_has_running_true(self, tmp_path, monkeypatch):
        """When automation_config.json has running: true, returns True."""
        (tmp_path / "automation_config.json").write_text('{"running": true}', encoding="utf-8")
        import automation.automation as automation_module
        monkeypatch.setattr(automation_module, "__file__", str(tmp_path / "automation.py"))
        from automation.automation import is_automation_running
        assert is_automation_running() is True

    def test_returns_false_when_config_has_running_false(self, tmp_path, monkeypatch):
        """When automation_config.json has running: false, returns False."""
        (tmp_path / "automation_config.json").write_text('{"running": false}', encoding="utf-8")
        import automation.automation as automation_module
        monkeypatch.setattr(automation_module, "__file__", str(tmp_path / "automation.py"))
        from automation.automation import is_automation_running
        assert is_automation_running() is False

    def test_returns_false_when_config_file_missing(self, tmp_path, monkeypatch):
        """When automation_config.json does not exist, returns False."""
        import automation.automation as automation_module
        monkeypatch.setattr(automation_module, "__file__", str(tmp_path / "automation.py"))
        from automation.automation import is_automation_running
        assert is_automation_running() is False


@pytest.mark.unit
class TestDailySummary:
    """Tests for daily_summary()."""

    def test_parses_summary_line(self):
        """Summary line with N emails is parsed for total count."""
        from automation.automation import daily_summary
        text = "## Summary\n5 emails from 3 senders\n\n## 🔴 High Priority\n1. **From A**: x"
        result = daily_summary(text)
        assert "Summary:" in result
        assert "5" in result
        assert "emails" in result

    def test_parses_priority_sections(self):
        """High/medium/low/automated item counts are extracted."""
        from automation.automation import daily_summary
        text = (
            "## Summary\n10 emails from 5 senders\n"
            "## 🔴 High Priority (Urgent)\n"
            "1. **From Alice**: Urgent\n"
            "2. **From Bob**: Also urgent\n"
            "## 🟡 Medium Priority\n"
            "1. **From Carol**: Medium\n"
            "## 🟢 Low Priority\n\n"
            "## ⚪ Automated/FYI\n"
            "1. **From System**: Newsletter"
        )
        result = daily_summary(text)
        assert "high" in result and "2" in result
        assert "medium" in result
        assert "low" in result
        assert "automated" in result
        assert "processed=" in result

    def test_empty_input_returns_summary_format(self):
        """Empty or minimal input still returns a summary-shaped string."""
        from automation.automation import daily_summary
        result = daily_summary("")
        assert "Summary:" in result or "processed=" in result
        result2 = daily_summary("No emails today")
        assert "processed=" in result2


@pytest.mark.unit
class TestWriteBriefingForFrontend:
    """Tests for write_briefing_for_frontend()."""

    def test_writes_valid_json_with_briefing_and_summary(self, tmp_path, monkeypatch):
        """Writes JSON with lastRunAt, briefing, summary."""
        import automation.automation as automation_module
        briefing_file = tmp_path / "data" / "automation_briefing.json"
        monkeypatch.setattr(automation_module, "BRIEFING_FILE", briefing_file)
        from automation.automation import write_briefing_for_frontend
        write_briefing_for_frontend("Briefing text", "Summary line")
        assert briefing_file.exists()
        data = json.loads(briefing_file.read_text(encoding="utf-8"))
        assert "lastRunAt" in data
        assert data["briefing"] == "Briefing text"
        assert data["summary"] == "Summary line"

    def test_handles_empty_strings(self, tmp_path, monkeypatch):
        """Empty briefing/summary are stored as empty strings."""
        import automation.automation as automation_module
        briefing_file = tmp_path / "data" / "briefing.json"
        monkeypatch.setattr(automation_module, "BRIEFING_FILE", briefing_file)
        from automation.automation import write_briefing_for_frontend
        write_briefing_for_frontend("", "")
        data = json.loads(briefing_file.read_text(encoding="utf-8"))
        assert data["briefing"] == ""
        assert data["summary"] == ""


@pytest.mark.unit
class TestPauseResumeAutomation:
    """Tests for pause_automation() and resume_automation()."""

    def test_resume_writes_running_true(self, tmp_path):
        """resume_automation() writes running: true to config."""
        automation_dir = tmp_path / "automation"
        automation_dir.mkdir()
        config_file = automation_dir / "automation_config.json"
        config_file.write_text('{"running": false}', encoding="utf-8")
        orig_cwd = os.getcwd()
        try:
            os.chdir(tmp_path)
            from automation.automation import resume_automation
            result = resume_automation()
            assert "resumed" in result.lower()
            data = json.loads(config_file.read_text(encoding="utf-8"))
            assert data["running"] is True
        finally:
            os.chdir(orig_cwd)

    def test_pause_writes_running_false(self, tmp_path):
        """pause_automation() writes running: false to config."""
        automation_dir = tmp_path / "automation"
        automation_dir.mkdir()
        config_file = automation_dir / "automation_config.json"
        config_file.write_text('{"running": true}', encoding="utf-8")
        orig_cwd = os.getcwd()
        try:
            os.chdir(tmp_path)
            from automation.automation import pause_automation
            result = pause_automation()
            assert "paused" in result.lower()
            data = json.loads(config_file.read_text(encoding="utf-8"))
            assert data["running"] is False
        finally:
            os.chdir(orig_cwd)

    def test_resume_creates_file_if_missing(self, tmp_path):
        """resume_automation() creates config file if it does not exist."""
        automation_dir = tmp_path / "automation"
        automation_dir.mkdir()
        config_file = automation_dir / "automation_config.json"
        orig_cwd = os.getcwd()
        try:
            os.chdir(tmp_path)
            from automation.automation import resume_automation
            resume_automation()
            assert config_file.exists()
            data = json.loads(config_file.read_text(encoding="utf-8"))
            assert data["running"] is True
        finally:
            os.chdir(orig_cwd)


@pytest.mark.unit
class TestRunOnce:
    """Tests for run_once()."""

    @patch("automation.automation.write_briefing_for_frontend")
    @patch("automation.automation.daily_summary")
    @patch("automation.automation.run_today")
    @patch("automation.automation.is_automation_running")
    def test_returns_false_when_not_running(self, mock_running, mock_today, mock_summary, mock_write):
        """When is_automation_running() is False, run_once() returns False and does not run today."""
        mock_running.return_value = False
        from automation.automation import run_once
        result = run_once()
        assert result is False
        mock_today.assert_not_called()
        mock_write.assert_not_called()

    @patch("automation.automation.write_briefing_for_frontend")
    @patch("automation.automation.daily_summary")
    @patch("automation.automation.run_today")
    @patch("automation.automation.is_automation_running")
    def test_runs_today_and_writes_briefing_when_running(self, mock_running, mock_today, mock_summary, mock_write):
        """When is_automation_running() is True, run_once() runs today, summary, and writes briefing."""
        mock_running.return_value = True
        mock_today.return_value = "Briefing content"
        mock_summary.return_value = "Summary: 3 emails"
        from automation.automation import run_once
        result = run_once()
        assert result is True
        mock_today.assert_called_once()
        mock_summary.assert_called_once_with("Briefing content")
        mock_write.assert_called_once_with("Briefing content", "Summary: 3 emails")
