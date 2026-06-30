# oo-chat

An open-source web chat client for [ConnectOnion](https://docs.connectonion.com)
agents, built with Next.js 16. Paste an agent's `0x…` address and chat with it —
streamed tool calls, approvals, plan reviews, and autonomous "ultra-long work" runs
included.

oo-chat is a thin front end: the heavy lifting (connecting to an agent, the
WebSocket protocol, streaming, and per-session persistence) lives in the
`connectonion` TypeScript SDK ([`../connectonion-ts`](https://github.com/openonion/connectonion-ts)).
oo-chat handles routing, layout, and rendering the SDK's event stream.

## How it works (30-second version)

```
You paste 0x…  →  /[address] (agent profile)  →  /[address]/[sessionId] (live chat)
                                                          │
                            useAgentForHuman(address, sessionId)   ← connectonion/react SDK
                                                          │
                            WebSocket → wss://oo.openonion.ai (relay) → the remote agent
```

- **User identity** is a BIP39 mnemonic → Ed25519 keypair generated in your browser
  (`localStorage['connectonion_keys']`), authenticated against `oo.openonion.ai`.
- **Agents** are addressed by their `0x…` public key; profile + online status come
  from the relay (`fetchAgentInfo`).
- **Transcripts** are persisted by the SDK per session
  (`localStorage['co:agent:{address}:session:{id}']`); the sidebar store only keeps a
  lightweight conversation index.

📖 **Full data-flow walkthrough: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).**

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the app, paste an agent address, and start chatting. A user identity (recovery
phrase) is generated automatically on first load — back it up from **Settings**.

### Environment

The app reads a single env var (optional):

```bash
NEXT_PUBLIC_OPENONION_API_URL=https://oo.openonion.ai   # auth/profile backend (default)
```

The relay (`wss://oo.openonion.ai`) is an SDK default and not configured here. See
`.env.example`.

## Scripts

```bash
npm run dev      # dev server (localhost:3000)
npm run build    # production build (what Vercel runs)
npm run lint     # ESLint
npm start        # serve the production build
```

## Project layout

```
app/
├── page.tsx                       # agent picker / welcome
├── [address]/page.tsx             # agent landing (profile + first message)
├── [address]/[sessionId]/page.tsx # live chat session
├── settings/page.tsx              # identity, credits, agents
└── api/
    ├── auth/route.ts              # CORS proxy → oo.openonion.ai auth
    └── chat/route.ts              # legacy/unused (see ARCHITECTURE §10)

components/chat/                   # chat UI: use-agent-sdk.ts + message renderers
hooks/                            # use-identity, use-agent-info
store/chat-store.ts               # sidebar conversation index (zustand + persist)
docs/                             # ARCHITECTURE.md, DEPLOY.md
```

## The SDK

`connectonion` is a separate package. For local development `node_modules/connectonion`
is symlinked to `../connectonion-ts`; production builds use the published npm version
pinned in `package.json`. Publishing the SDK and shipping oo-chat is documented in
[`docs/DEPLOY.md`](docs/DEPLOY.md).

## Related projects

- [`../connectonion-ts`](https://github.com/openonion/connectonion-ts) — the
  TypeScript SDK (`connectonion` on npm): `useAgentForHuman`, `RemoteAgent`, the
  WebSocket protocol, session persistence.
- `../chat-ui` (`@connectonion/chat-ui`) — source registry for the chat components.
  When fixing design issues in `components/chat/`, mirror the change into
  `../chat-ui/registry/` to keep them in sync.

## Deploy

Hosted on Vercel (project `oo-chat`). Push a branch for a preview deploy; merge to
`main` for production. See [`docs/DEPLOY.md`](docs/DEPLOY.md).
