"""
Email Agent CLI - Interactive email management from your terminal

Usage:
    email              # Interactive mode (default)
    email inbox        # Show recent emails
    email today        # Daily briefing
    email ask "query"  # One-shot question
    email init         # Initialize CRM database
"""

from dotenv import load_dotenv
load_dotenv()  # Load .env before importing agent

from cli import app

if __name__ == "__main__":
    app()
