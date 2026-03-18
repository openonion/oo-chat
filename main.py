"""
Email Agent - HTTP Server for deployment

Purpose: Deploy email-agent as HTTP server on ConnectOnion Cloud
Usage: co deploy (uses this file as entrypoint)
"""

from agent import agent
from connectonion import host
from cli.core import CommandRouter

# Wrap agent with CommandRouter so slash commands (/today, /events, etc.)
# are handled directly without going through the LLM.
router = CommandRouter(agent)

# trust="strict" requires signed requests with Ed25519 signature
# This prevents unauthorized access to email tools
host(lambda: router, trust="careful")
