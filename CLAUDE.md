# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oo-chat is an open-source web chat client for ConnectOnion agents, built with Next.js 16.
You connect to an agent by its `0x…` address; the live conversation runs over a WebSocket
through the `connectonion` TypeScript SDK (`../connectonion-ts`). oo-chat is a thin front end —
routing, layout, and rendering the SDK's streamed event list — while the SDK owns the agent
connection, the protocol, and per-session persistence.

There is one connection path: **remote agent over WebSocket via the SDK**. The "modes" in the
UI (`safe` / `plan` / `accept_edits` / `ulw`) are trust/approval levels, not connection types.
(An older HTTP "Direct LLM" mode was removed; `app/api/chat/route.ts` is dead code.)

Part of the ConnectOnion platform ecosystem.

**Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full data flow** and
[`docs/DEPLOY.md`](docs/DEPLOY.md) for the SDK-publish → Vercel pipeline.

## Development Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint check
npm start        # Run production build
```

## Architecture

```
app/
├── page.tsx                        # Agent picker / welcome (paste 0x address)
├── [address]/page.tsx              # Agent landing: profile + first message
├── [address]/[sessionId]/page.tsx  # Live chat session (the core page)
├── settings/page.tsx               # Identity, recovery phrase, credits, agents
├── layout.tsx                      # Root layout
├── globals.css                     # Tailwind CSS styles
└── api/
    ├── auth/route.ts               # CORS proxy → oo.openonion.ai auth (live)
    └── chat/route.ts               # legacy/unused — see ARCHITECTURE §10

components/chat/
├── use-agent-sdk.ts                # Wraps SDK useAgentForHuman; extracts pending states
├── chat.tsx                        # Main Chat component
├── chat-input.tsx                  # Message input (+ SDK useVoiceInput)
├── chat-messages.tsx               # Switches ChatItem.type → message component
├── messages/                       # Per-event renderers (agent, tool-call, ask-user, …)
├── types.ts                        # UI/ChatItem + Pending* type definitions
└── index.ts                        # Barrel exports

hooks/use-identity.ts               # BIP39→Ed25519 user keypair + auth
hooks/use-agent-info.ts             # Wraps SDK fetchAgentInfo (30s polling)
store/chat-store.ts                 # Sidebar conversation INDEX (not the transcript)
```

### Key Patterns

**Live chat** (`app/[address]/[sessionId]/page.tsx` → `components/chat/use-agent-sdk.ts`):
- `useAgentForHuman(address, sessionId)` (from `connectonion/react`) opens a WebSocket
  to the relay and returns `ui: ChatItem[]` plus `send`/`sendMessage`/`setMode`/`reconnect`.
- `use-agent-sdk.ts` derives the `pending*` interaction cards (ask_user, approval, plan,
  onboard, ULW) from the event stream and the connection/session state.

**Index vs transcript** (intentional split):
- `store/chat-store.ts` (zustand `persist`, `localStorage['oo-chat-storage']`) holds only the
  sidebar index (`{sessionId, title, agentAddress, createdAt}`), `agents[]`, the JWT, and the
  user profile. **No transcript, no images.**
- The transcript's single source of truth is the SDK's per-session store
  (`localStorage['co:agent:{address}:session:{id}']`), capped at 20 sessions and
  base64-sanitized by the SDK.

**Identity** (`hooks/use-identity.ts`): BIP39 mnemonic → Ed25519 keypair (tweetnacl) in
`localStorage['connectonion_keys']`; signs an auth message → `/api/auth` → JWT.

**Path Alias**: `@/*` maps to project root.

## Environment Variables

```bash
NEXT_PUBLIC_OPENONION_API_URL   # Auth/profile backend (default https://oo.openonion.ai)
```

The relay (`wss://oo.openonion.ai`) is an SDK default (`ConnectOptions.relayUrl`), not an
oo-chat env var. The `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` /
`NEXT_PUBLIC_DEFAULT_AGENT_URL` entries in `.env.example` belong to the removed Direct LLM mode
and are unused.

## Dependencies

- `connectonion`: the TypeScript SDK — agent connection, WebSocket protocol, session
  persistence, `useAgentForHuman`, `fetchAgentInfo`, `useVoiceInput`. Pinned by semver
  (`^0.1.x`) for production; symlinked to `../connectonion-ts` for local dev (see DEPLOY.md).
- `zustand`: state + localStorage persistence (sidebar index, SDK session store).
- `bip39` + `tweetnacl`: browser BIP39/Ed25519 user identity.
- `react-icons`: UI icons. `clsx` + `tailwind-merge`: conditional classes.
- `react-markdown` + `remark-gfm` + `react-syntax-highlighter`: message rendering.

## Related Projects

- `../chat-ui` (`@connectonion/chat-ui`): Source component library for the chat components. When fixing design issues in `components/chat/`, also update the corresponding files in `../chat-ui/registry/` to keep them in sync.
