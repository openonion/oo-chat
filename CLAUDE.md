# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

oo-chat is an open-source web chat client for ConnectOnion agents, built with Next.js 16.
You connect to an agent by its `0x…` address; the live conversation runs over a WebSocket
through the `@connectonion/react` hooks (`../connectonion-react`), which sit on the
`connectonion` TypeScript SDK (`../connectonion-ts`). oo-chat is a thin front end —
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
npm test         # Vitest (unit tests)
npm start        # Run production build
```

`*.contract.test.ts` files are type-level assertions checked by `tsc` during
`npm run build`, not runtime suites — `vitest.config.ts` excludes them.

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

components/dashboard/               # "Home" — the agent's own dashboard.html
├── workspace-shell.tsx             # Chat + Home split; mobile Home|Chat switch
├── dashboard-pane.tsx              # Sandboxed iframe + button→skill bridge
└── build-srcdoc.ts                 # Wraps agent HTML with the CSP + bridge

hooks/use-identity.ts               # BIP39→Ed25519 user keypair + auth
hooks/use-agent-info.ts             # Wraps SDK fetchAgentInfo (30s polling)
store/chat-store.ts                 # Sidebar conversation INDEX (not the transcript)
```

### Key Patterns

**Live chat** (`app/[address]/[sessionId]/page.tsx` → `components/chat/use-agent-sdk.ts`):
- `useAgentForHuman(address, sessionId)` (from `@connectonion/react`) opens a WebSocket
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

**Home / dashboard** (`components/dashboard/`):
- The agent's `dashboard.html` arrives as `dashboardHtml` from the SDK hook (pushed on
  connect and after any run that changed it — nothing is fetched or polled).
- **The HTML is untrusted.** It renders in `sandbox="allow-scripts"` (opaque origin) plus
  a CSP with a per-render nonce. `build-srcdoc.ts` **wraps** the agent HTML in a document
  we own — never inject into theirs; string-matching `<head>` is defeatable by a `<head>`
  in a comment, which drops the CSP entirely.
- Button clicks arrive by `postMessage` and are **untrusted intent**: verify the source
  frame, shape-check the skill name, and require it to be in the agent's published skill
  list, failing closed while that list is loading.
- **A dashboard is one self-contained page and does not link out.** The bridge cancels
  clicks on non-fragment `<a href>`, and the pane treats a second iframe load as
  navigation-away (a `<meta refresh>`) and blocks it. Neither CSP nor sandbox prevents a
  frame from navigating itself, and the destination runs under its own CSP. Supporting
  external links later means revisiting that whole contract, not relaxing the handler.
- `hasDashboard` gates the pane. Many agents have no dashboard and nothing on the wire
  says so — only the absence of a snapshot.

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

- `@connectonion/react`: the React layer — `useAgentForHuman`, `useVoiceInput`, the
  Zustand session store, browser identity. This is what oo-chat imports.
- `connectonion`: the TypeScript SDK underneath it — agent connection, WebSocket protocol,
  `fetchAgentInfo`. A peer of `@connectonion/react`, so exactly one copy is installed.
  Both are pinned by semver; symlinking either to a local checkout hides breakage that
  only shows up against the published package (see DEPLOY.md).
- `zustand`: state + localStorage persistence (sidebar index, SDK session store).
- `bip39` + `tweetnacl`: browser BIP39/Ed25519 user identity.
- `react-icons`: UI icons. `clsx` + `tailwind-merge`: conditional classes.
- `react-markdown` + `remark-gfm` + `react-syntax-highlighter`: message rendering.

## Related Projects

- `../chat-ui` (`@connectonion/chat-ui`): Source component library for the chat components. When fixing design issues in `components/chat/`, also update the corresponding files in `../chat-ui/registry/` to keep them in sync.
