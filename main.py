"""
Email Agent - HTTP Server for deployment

Purpose: Deploy email-agent as HTTP server on ConnectOnion Cloud
Usage: co deploy (uses this file as entrypoint)
"""

from agent import agent
from connectonion import host

# trust="open"    - no auth, anyone can connect (local dev)
# trust="careful" - default, blocks unknown frontends via fast rules
# trust="strict"  - requires signed Ed25519 requests
host(lambda: agent, trust="careful")
