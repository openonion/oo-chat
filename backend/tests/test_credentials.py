"""Tests for Google OAuth credentials handling."""

import pytest
from unittest.mock import Mock, patch, MagicMock


class TestCredentialsWithoutClientSecrets:
    """Test that credentials work without client_id and client_secret."""

    def test_credentials_object_accepts_none_values(self):
        """Verify Credentials can be created with client_id=None."""
        from google.oauth2.credentials import Credentials

        creds = Credentials(
            token="test_access_token",
            refresh_token="test_refresh_token",
            token_uri="https://oauth2.googleapis.com/token",
            client_id=None,
            client_secret=None,
            scopes=[
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.modify"
            ]
        )

        assert creds.token == "test_access_token"
        assert creds.refresh_token == "test_refresh_token"
        assert creds.client_id is None
        assert creds.client_secret is None

    @patch('googleapiclient.discovery.build')
    def test_gmail_service_builds_with_none_credentials(self, mock_build):
        """Verify Gmail service can be built with client_id=None."""
        from google.oauth2.credentials import Credentials

        mock_service = Mock()
        mock_build.return_value = mock_service

        creds = Credentials(
            token="test_token",
            refresh_token="test_refresh",
            token_uri="https://oauth2.googleapis.com/token",
            client_id=None,
            client_secret=None,
        )

        from googleapiclient.discovery import build
        service = build('gmail', 'v1', credentials=creds)

        mock_build.assert_called_once_with('gmail', 'v1', credentials=creds)
        assert service == mock_service


class TestCredentialsFromEnv:
    """Test loading credentials from environment variables."""

    @patch.dict('os.environ', {
        'GOOGLE_ACCESS_TOKEN': 'env_access_token',
        'GOOGLE_REFRESH_TOKEN': 'env_refresh_token'
    })
    def test_loads_tokens_from_env(self):
        """Verify tokens can be loaded from environment."""
        import os

        access_token = os.getenv("GOOGLE_ACCESS_TOKEN")
        refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")

        assert access_token == "env_access_token"
        assert refresh_token == "env_refresh_token"

    @patch.dict('os.environ', {}, clear=True)
    def test_returns_none_when_env_missing(self):
        """Verify None returned when env vars missing."""
        import os

        access_token = os.getenv("GOOGLE_ACCESS_TOKEN")
        refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")

        assert access_token is None
        assert refresh_token is None


@pytest.mark.real_api
class TestCredentialsIntegration:
    """Integration tests for credentials with real API.

    Run with: pytest tests/ -m real_api
    """

    def test_credentials_from_env_are_valid(self):
        """Verify credentials from .env can authenticate."""
        import os
        from dotenv import load_dotenv
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        load_dotenv()

        access_token = os.getenv("GOOGLE_ACCESS_TOKEN")
        refresh_token = os.getenv("GOOGLE_REFRESH_TOKEN")

        assert access_token, "GOOGLE_ACCESS_TOKEN not set in .env"
        assert refresh_token, "GOOGLE_REFRESH_TOKEN not set in .env"

        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=None,
            client_secret=None,
            scopes=[
                "https://www.googleapis.com/auth/gmail.readonly",
                "https://www.googleapis.com/auth/gmail.modify"
            ]
        )

        service = build('gmail', 'v1', credentials=creds)
        profile = service.users().getProfile(userId='me').execute()

        assert 'emailAddress' in profile
