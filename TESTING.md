# oo-chat Testing Guide

This document explains how to start and test the oo-chat application with its backend.

## Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│    oo-chat      │ ◄───────────────► │      oo         │
│  (Frontend)     │   port 8000        │   (Backend)     │
│  port 3000      │                    │   co-ai agent   │
└─────────────────┘                    └─────────────────┘
        │
        └── uses connectonion-ts SDK for WebSocket streaming
```

- **oo-chat**: Next.js frontend at `localhost:3000`
- **oo**: CLI command that runs the co-ai agent at `localhost:8000`
- **connectonion-ts**: TypeScript SDK providing `useAgentSDK` hook for WebSocket streaming

## Starting the Services

### 1. Start Backend (co-ai agent)

```bash
# Clear proxy settings and run oo
http_proxy="" https_proxy="" all_proxy="" oo
```

This starts the agent server with:
- HTTP endpoint: `POST http://localhost:8000/input`
- WebSocket: `ws://localhost:8000/ws`
- API docs: `http://localhost:8000/docs`

### 2. Start Frontend (oo-chat)

```bash
cd oo-chat
npm run dev
```

Frontend runs at `http://localhost:3000`

## Testing

### UI Screenshot Testing

Use the `co -b` command for browser automation and screenshot testing:

```bash
# Clear proxy settings before running
http_proxy="" https_proxy="" all_proxy="" co -b "screenshot localhost:3000"
```

The screenshot will be saved to `.tmp/screenshot_*.png`.

### Example Test Commands

```bash
# Basic screenshot
http_proxy="" https_proxy="" all_proxy="" co -b "screenshot localhost:3000"

# Screenshot with specific viewport
http_proxy="" https_proxy="" all_proxy="" co -b "screenshot localhost:3000 with 1920x1080 viewport"

# Interactive testing
http_proxy="" https_proxy="" all_proxy="" co -b "go to localhost:3000 and send message 'hello'"
```

### Manual Testing Workflow

1. Start backend: `http_proxy="" https_proxy="" all_proxy="" oo`
2. Start frontend: `cd oo-chat && npm run dev`
3. Open `http://localhost:3000` in browser
4. Send a message and verify:
   - Tool calls display with timing
   - Elapsed time shows during processing
   - Response appears correctly

## Proxy Issues

If you encounter proxy-related errors like:
```
ValueError: Unknown scheme for proxy URL URL('socks5h://...')
```

Always prefix commands with proxy clearing:
```bash
http_proxy="" https_proxy="" all_proxy="" <command>
```

Or disable system SOCKS proxy in System Preferences > Network > Wi-Fi > Proxies.

## SDK Integration

oo-chat uses `connectonion-ts` SDK's `useAgentSDK` hook:

```typescript
import { useAgentSDK } from 'connectonion/react'

const {
  messages,      // Chat messages
  uiEvents,      // Tool calls and thinking events
  elapsedTime,   // Time since request started (ms)
  isLoading,     // Processing state
  send,          // Send message function
  clear,         // Reset conversation
} = useAgentSDK({
  agentUrl: 'http://localhost:8000'
})
```

The SDK connects via WebSocket to `ws://localhost:8000/ws` for real-time streaming of:
- Tool execution status
- Thinking indicators
- Final response

## File Structure

```
oo-chat/
├── app/page.tsx                    # Main app using useAgentSDK
├── components/chat/
│   ├── use-agent-sdk.ts           # SDK hook adapter
│   ├── chat.tsx                   # Chat UI component
│   └── types.ts                   # UIEvent, Message types
└── TESTING.md                     # This file

connectonion-ts/
├── src/connect.ts                 # RemoteAgent, UIEvent types
└── src/react/index.ts             # useAgent hook
```
