"""Unit tests for daily automation (automation package)."""

import json
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
        """Summary line with N emails is parsed for processed count."""
        from automation.automation import daily_summary
        text = "## Summary\n5 emails from 3 senders\n\n## 🔴 High Priority\n1. **From A**: x"
        result = daily_summary(text)
        assert "5 emails processed during scan" in result
        assert "0 drafts to review" in result
        assert "0 scheduled" in result

    def test_parses_priority_sections(self):
        """When no numeric summary line, priority item counts set processed total."""
        from automation.automation import daily_summary
        text = (
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
        # high=2, medium=1, low=0, automated=1 → 4
        assert "4 emails processed during scan" in result

    def test_uses_summary_total_when_present(self):
        """Briefing 'N emails' line wins over section counts when both exist."""
        from automation.automation import daily_summary
        text = (
            "## Summary\n10 emails from 5 senders\n"
            "## 🔴 High Priority (Urgent)\n"
            "1. **From Alice**: Urgent\n"
        )
        result = daily_summary(text)
        assert "10 emails processed during scan" in result

    def test_empty_input_returns_summary_format(self):
        """Empty or minimal input still returns a summary-shaped string."""
        from automation.automation import daily_summary
        result = daily_summary("")
        assert "0 emails processed during scan" in result
        result2 = daily_summary("No emails today")
        assert "0 emails processed during scan" in result2

    def test_includes_draft_count_when_provided(self):
        """draft_count appears as drafts to review."""
        from automation.automation import daily_summary
        result = daily_summary("## Summary\n2 emails from 1 senders", draft_count=3)
        assert "2 emails processed during scan" in result
        assert "3 drafts to review" in result


@pytest.mark.unit
class TestWriteBriefingForFrontend:
    """Tests for write_briefing_for_frontend()."""

    def test_writes_valid_json_with_briefing_and_summary(self, tmp_path, monkeypatch):
        """Writes JSON with scanSince/scanUntil, briefing, summary."""
        import automation.automation as automation_module
        briefing_file = tmp_path / "data" / "automation_briefing.json"
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: briefing_file)
        from automation.automation import write_briefing_for_frontend
        write_briefing_for_frontend(
            "Briefing text",
            "Summary line",
            drafts=[],
            provider="gmail",
            scanSince=1.0,
            scanUntil=2.0,
            messagesSeen=0,
        )
        assert briefing_file.exists()
        data = json.loads(briefing_file.read_text(encoding="utf-8"))
        assert "scanSince" in data
        assert "scanUntil" in data
        assert data["briefing"] == "Briefing text"
        assert data["summary"] == "Summary line"
        assert data["drafts"] == []
        assert data["provider"] == "gmail"

    def test_handles_empty_strings(self, tmp_path, monkeypatch):
        """Empty briefing/summary are stored as empty strings."""
        import automation.automation as automation_module
        briefing_file = tmp_path / "data" / "briefing.json"
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: briefing_file)
        from automation.automation import write_briefing_for_frontend
        write_briefing_for_frontend(
            "",
            "",
            drafts=[],
            provider="none",
            scanSince=0.0,
            scanUntil=0.0,
            messagesSeen=0,
        )
        data = json.loads(briefing_file.read_text(encoding="utf-8"))
        assert data["briefing"] == ""
        assert data["summary"] == ""


@pytest.mark.unit
class TestPauseResumeAutomation:
    """Tests for pause_automation() and resume_automation()."""

    def test_resume_writes_running_true(self, tmp_path, monkeypatch):
        """resume_automation() writes running: true to config."""
        import automation.automation as automation_module

        automation_dir = tmp_path / "automation"
        automation_dir.mkdir()
        config_file = automation_dir / "automation_config.json"
        config_file.write_text('{"running": false}', encoding="utf-8")
        monkeypatch.setattr(automation_module, "config_file_path", lambda: config_file)
        from automation.automation import resume_automation

        result = resume_automation()
        assert "resumed" in result.lower()
        data = json.loads(config_file.read_text(encoding="utf-8"))
        assert data["running"] is True

    def test_pause_writes_running_false(self, tmp_path, monkeypatch):
        """pause_automation() writes running: false to config."""
        import automation.automation as automation_module

        automation_dir = tmp_path / "automation"
        automation_dir.mkdir()
        config_file = automation_dir / "automation_config.json"
        config_file.write_text('{"running": true}', encoding="utf-8")
        monkeypatch.setattr(automation_module, "config_file_path", lambda: config_file)
        from automation.automation import pause_automation

        result = pause_automation()
        assert "paused" in result.lower()
        data = json.loads(config_file.read_text(encoding="utf-8"))
        assert data["running"] is False

    def test_resume_creates_file_if_missing(self, tmp_path, monkeypatch):
        """resume_automation() creates config file if it does not exist."""
        import automation.automation as automation_module

        automation_dir = tmp_path / "automation"
        automation_dir.mkdir()
        config_file = automation_dir / "automation_config.json"
        monkeypatch.setattr(automation_module, "config_file_path", lambda: config_file)
        from automation.automation import resume_automation

        resume_automation()
        assert config_file.exists()
        data = json.loads(config_file.read_text(encoding="utf-8"))
        assert data["running"] is True


@pytest.mark.unit
class TestRunOnce:
    """Tests for run_once()."""

    @patch("automation.automation.write_briefing_for_frontend")
    @patch("automation.automation.run_automation_pipeline")
    @patch("automation.automation.is_automation_running")
    def test_returns_false_when_not_running(self, mock_running, mock_pipeline, mock_write):
        """When is_automation_running() is False, run_once() returns False and does not run pipeline."""
        mock_running.return_value = False
        from automation.automation import run_once
        result = run_once()
        assert result is False
        mock_pipeline.assert_not_called()
        mock_write.assert_not_called()

    @patch("automation.automation.load_persisted_drafts")
    @patch("automation.automation.set_last_scanned_at")
    @patch("automation.automation.write_briefing_for_frontend")
    @patch("automation.automation.run_automation_pipeline")
    @patch("automation.automation.is_automation_running")
    def test_runs_pipeline_and_writes_briefing_when_running(
        self, mock_running, mock_pipeline, mock_write, mock_set_ts, mock_load_drafts
    ):
        """When running, run_once() runs pipeline, writes briefing, advances lastScannedAt."""
        mock_running.return_value = True
        mock_load_drafts.return_value = []
        drafts = [
            {
                "draftId": "d1",
                "messageId": "m1",
                "subject": "Hi",
                "from": "a@b.com",
                "draftBody": "Thanks",
            }
        ]
        mock_pipeline.return_value = (
            "Briefing content",
            drafts,
            "gmail",
            5,
            100.0,
            200.0,
        )
        from automation.automation import run_once
        result = run_once()
        assert result is True
        mock_pipeline.assert_called_once()
        mock_write.assert_called_once()
        call_kw = mock_write.call_args[1]
        assert call_kw["drafts"] == drafts
        assert call_kw["scanUntil"] == 200.0
        mock_set_ts.assert_called_once_with(200.0)


@pytest.mark.unit
class TestWatermark:
    """get_last_scanned_at / set_last_scanned_at via config file."""

    def test_get_last_scanned_at_none_when_missing(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        cfg = tmp_path / "automation_config.json"
        cfg.write_text("{}", encoding="utf-8")
        monkeypatch.setattr(automation_module, "config_file_path", lambda: cfg)
        from automation.automation import get_last_scanned_at

        assert get_last_scanned_at() is None

    def test_get_last_scanned_at_none_when_invalid(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        cfg = tmp_path / "automation_config.json"
        cfg.write_text('{"lastScannedAt": "not-a-number"}', encoding="utf-8")
        monkeypatch.setattr(automation_module, "config_file_path", lambda: cfg)
        from automation.automation import get_last_scanned_at

        assert get_last_scanned_at() is None

    def test_get_set_last_scanned_at_roundtrip(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        cfg = tmp_path / "automation_config.json"
        cfg.write_text("{}", encoding="utf-8")
        monkeypatch.setattr(automation_module, "config_file_path", lambda: cfg)
        from automation.automation import get_last_scanned_at, set_last_scanned_at

        set_last_scanned_at(12345.5)
        assert get_last_scanned_at() == 12345.5


@pytest.mark.unit
class TestLoadPersistedDrafts:
    """load_persisted_drafts()."""

    def test_empty_when_briefing_file_missing(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import load_persisted_drafts

        assert load_persisted_drafts() == []

    def test_returns_drafts_with_message_id(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        p.write_text(
            json.dumps(
                {
                    "drafts": [
                        {"messageId": "a", "draftId": "1"},
                        {"draftId": "2"},
                        "not-a-dict",
                    ]
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import load_persisted_drafts

        out = load_persisted_drafts()
        assert len(out) == 1
        assert out[0]["messageId"] == "a"

    def test_corrupt_json_returns_empty(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        p.write_text("{not json", encoding="utf-8")
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import load_persisted_drafts

        assert load_persisted_drafts() == []


@pytest.mark.unit
class TestRemoveDraftFromBriefing:
    """remove_draft_from_briefing()."""

    def test_false_when_file_missing(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "missing.json"
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import remove_draft_from_briefing

        assert remove_draft_from_briefing("m1", "d1") is False

    def test_remove_by_draft_id(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        p.write_text(
            json.dumps(
                {
                    "drafts": [
                        {"draftId": "keep", "messageId": "m1"},
                        {"draftId": "drop", "messageId": "m2"},
                    ]
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import remove_draft_from_briefing

        assert remove_draft_from_briefing("m2", "drop") is True
        data = json.loads(p.read_text(encoding="utf-8"))
        assert len(data["drafts"]) == 1
        assert data["drafts"][0]["draftId"] == "keep"

    def test_remove_by_message_id_when_no_draft_id(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        p.write_text(
            json.dumps({"drafts": [{"draftId": "x", "messageId": "mid"}]}),
            encoding="utf-8",
        )
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import remove_draft_from_briefing

        assert remove_draft_from_briefing("mid", None) is True
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data["drafts"] == []


@pytest.mark.unit
class TestUpdateDraftBodyInBriefing:
    """update_draft_body_in_briefing()."""

    def test_false_without_ids(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        p.write_text(json.dumps({"drafts": []}), encoding="utf-8")
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import update_draft_body_in_briefing

        assert update_draft_body_in_briefing("new", draft_id=None, message_id=None) is False

    def test_update_by_draft_id(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        p.write_text(
            json.dumps(
                {
                    "drafts": [
                        {"draftId": "a", "messageId": "m1", "draftBody": "old"},
                        {"draftId": "b", "messageId": "m2", "draftBody": "keep"},
                    ]
                }
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import update_draft_body_in_briefing

        assert update_draft_body_in_briefing("revised", draft_id="a") is True
        data = json.loads(p.read_text(encoding="utf-8"))
        assert data["drafts"][0]["draftBody"] == "revised"
        assert data["drafts"][1]["draftBody"] == "keep"

    def test_update_by_message_id_first_match(self, tmp_path, monkeypatch):
        import automation.automation as automation_module

        p = tmp_path / "automation_briefing.json"
        p.write_text(
            json.dumps(
                {"drafts": [{"draftId": "x", "messageId": "mid", "draftBody": "was"}]}
            ),
            encoding="utf-8",
        )
        monkeypatch.setattr(automation_module, "briefing_file_path", lambda: p)
        from automation.automation import update_draft_body_in_briefing

        assert update_draft_body_in_briefing("now", message_id="mid") is True
        assert json.loads(p.read_text(encoding="utf-8"))["drafts"][0]["draftBody"] == "now"


@pytest.mark.unit
class TestRunAutomationPipeline:
    """Real run_automation_pipeline() with cli.core patched (explains coverage vs mocked run_once)."""

    @patch("cli.core.get_email_provider_name", return_value="gmail")
    @patch("cli.core.generate_reply_drafts", return_value=[{"messageId": "m1"}])
    @patch("cli.core.do_briefing_for_digest", return_value="briefing-out")
    @patch("cli.core._format_message_list_for_prompt", return_value="digest-text")
    @patch("cli.core.list_inbox_messages_since", return_value=[{"id": "m1"}])
    def test_pipeline_returns_briefing_drafts_and_scan_window(
        self,
        mock_list,
        _fmt,
        _brief,
        _drafts,
        _prov,
        monkeypatch,
    ):
        import automation.automation as automation_module

        monkeypatch.setattr(automation_module, "get_last_scanned_at", lambda: 1000.0)
        from automation.automation import run_automation_pipeline

        b, drafts, prov, n, scan_since, scan_until = run_automation_pipeline()
        assert b == "briefing-out"
        assert drafts == [{"messageId": "m1"}]
        assert prov == "gmail"
        assert n == 1
        assert scan_since == 1000.0
        assert scan_until >= scan_since
        mock_list.assert_called_once()
        call_ts, call_kw = mock_list.call_args[0][0], mock_list.call_args[1]
        assert call_ts == 1000.0
        assert call_kw.get("max_results") == 50

    @patch("cli.core.get_email_provider_name", return_value="none")
    @patch("cli.core.generate_reply_drafts", return_value=[])
    @patch("cli.core.do_briefing_for_digest", return_value="b")
    @patch("cli.core._format_message_list_for_prompt", return_value="d")
    @patch("cli.core.list_inbox_messages_since", return_value=[])
    def test_scan_since_defaults_to_lookback_when_no_watermark(
        self, mock_list, _fmt, _brief, _drafts, _prov, monkeypatch
    ):
        import automation.automation as automation_module
        import time

        monkeypatch.setattr(automation_module, "get_last_scanned_at", lambda: None)
        fixed_now = 10_000.0
        monkeypatch.setattr(time, "time", lambda: fixed_now)
        from automation.automation import run_automation_pipeline, DEFAULT_SCAN_LOOKBACK_SEC

        _b, _d, _p, n, scan_since, scan_until = run_automation_pipeline()
        assert n == 0
        assert scan_until == fixed_now
        assert scan_since == fixed_now - DEFAULT_SCAN_LOOKBACK_SEC
        mock_list.assert_called_once()


@pytest.mark.unit
class TestRunLoop:
    """run_loop() — stop after first sleep via interrupt."""

    def test_calls_run_once_then_stops_when_sleep_raises(self, monkeypatch):
        import automation.automation as automation_module

        calls = []
        monkeypatch.setattr(automation_module, "run_once", lambda: calls.append(1))

        def boom(_interval):
            raise RuntimeError("stop-test")

        monkeypatch.setattr("time.sleep", boom)

        with pytest.raises(RuntimeError, match="stop-test"):
            automation_module.run_loop(interval_seconds=7)
        assert calls == [1]


@pytest.mark.unit
class TestMergeDraftsPersist:
    """Tests for merge_drafts_persist()."""

    def test_keeps_previous_and_adds_new_message_ids(self):
        from automation.automation import merge_drafts_persist

        prev = [{"messageId": "a", "draftId": "1", "draftBody": "x"}]
        fresh = [{"messageId": "b", "draftId": "2", "draftBody": "y"}]
        merged = merge_drafts_persist(prev, fresh)
        assert len(merged) == 2
        assert merged[0]["messageId"] == "a"
        assert merged[1]["messageId"] == "b"

    def test_skips_fresh_when_message_id_already_pending(self):
        from automation.automation import merge_drafts_persist

        prev = [{"messageId": "a", "draftId": "1", "draftBody": "user edited"}]
        fresh = [{"messageId": "a", "draftId": "99", "draftBody": "llm new"}]
        merged = merge_drafts_persist(prev, fresh)
        assert len(merged) == 1
        assert merged[0]["draftBody"] == "user edited"


@pytest.mark.unit
class TestRefineDraft:
    """Tests for automation/refine_draft.py (LLM path patched)."""

    def test_perform_refine_ok(self):
        with patch("cli.core.refine_reply_draft", return_value="Revised reply."):
            from automation.refine_draft import perform_refine

            out = perform_refine(
                "make it shorter",
                "Long draft text",
                subject="Hi",
                from_line="a@b.com",
                original_email="Original",
            )
        assert out == {"ok": True, "draftBody": "Revised reply."}

    def test_perform_refine_empty_from_llm(self):
        with patch("cli.core.refine_reply_draft", return_value=""):
            from automation.refine_draft import perform_refine

            out = perform_refine("x", "y")
        assert out["ok"] is False
        assert "Empty" in (out.get("error") or "")
