# oo-chat Architecture & Data Flow

How oo-chat talks to ConnectOnion agents, end to end. This is the map for "where
does this data come from and where does it go."

oo-chat is a thin, stateless-on-the-server Next.js front end. **Almost all of the
real work — connecting to an agent, streaming the conversation, persisting the
transcript — lives in the `connectonion` TypeScript SDK** (`connectonion-ts`).
oo-chat is mostly routing, layout, and rendering the SDK's event stream.

---

## 1. The big picture

```
┌──────────────────────────── Browser (oo-chat, Next.js client) ───────────────────────────┐
│                                                                                            │
│   app/page.tsx ──▶ app/[address]/page.tsx ──▶ app/[address]/[sessionId]/page.tsx           │
│   (pick agent)      (agent profile)            (live chat)                                  │
│                                                     │                                       │
│                                                     ▼                                       │
│                                          components/chat/use-agent-sdk.ts                   │
│                                          (thin wrapper / pending-state extractor)           │
│                                                     │                                       │
│                                                     ▼                                       │
│   ┌──────────────────────── connectonion/react (the SDK) ─────────────────────────────┐    │
│   │  useAgentForHuman(address, sessionId)                                              │    │
│   │    • zustand session store  ──────────▶ localStorage: co:agent:{addr}:session:{id} │    │
│   │    • agent-cache (≤6 live sockets)                                                  │    │
│   │    • RemoteAgent ── WebSocket ───────────────────────────────┐                     │    │
│   └──────────────────────────────────────────────────────────────┼─────────────────────┘  │
│                                                                    │                        │
│   hooks/use-identity.ts ── /api/auth (proxy) ──┐                   │                        │
│   hooks/use-agent-info.ts ── fetchAgentInfo ───┼──── HTTPS ────────┼─────┐                  │
│   store/chat-store.ts ──▶ localStorage: oo-chat-storage            │     │                  │
│   use-identity ─────────▶ localStorage: connectonion_keys          │     │                  │
└────────────────────────────────────────────────────────────────────┼─────┼──────────────────┘
                                                                       │     │
                          wss://oo.openonion.ai (relay)  ◀─────────────┘     │ https://oo.openonion.ai
                                     │                                       │  • /api/v1/auth, /auth/me
                                     │                                       │  • /api/relay/agents/{addr}
                                     ▼                                       ▼
                          ┌──────────────────────┐                 ┌──────────────────┐
                          │  ConnectOnion Relay   │                 │   oo-api backend │
                          │  (oo.openonion.ai)    │                 │  (auth, profile, │
                          │  routes WS to agent   │                 │   credits, LLM)  │
                          └───────────┬──────────┘                 └──────────────────┘
                                      │  (or direct: https://{name}-{addr}.agents.openonion.ai)
                                      ▼
                          ┌──────────────────────┐
                          │   Remote Agent        │  (a deployed ConnectOnion agent)
                          │   streams the run     │
                          └──────────────────────┘
```

The only "modes" today are about *trust/approval* (`safe` / `plan` / `accept_edits`
/ `ulw`), not about *connection type*. **There is exactly one connection path:
remote agent over WebSocket via the SDK.** (The old "Direct LLM" mode is gone — see
[§10](#10-legacy--dead-code).)

---

## 2. The moving parts

| Piece | Where | Role |
|-------|-------|------|
| **oo-chat client** | this repo (`app/`, `components/`, `hooks/`, `store/`) | UI, routing, rendering the SDK event stream |
| **`connectonion` SDK** | `../connectonion-ts` (npm `connectonion`, symlinked for dev) | The actual agent connection, WebSocket protocol, session persistence |
| **Next.js API routes** | `app/api/auth`, `app/api/chat` | `/api/auth` is a CORS proxy to oo-api; `/api/chat` is legacy/unused |
| **Relay** | `wss://oo.openonion.ai` | Routes WebSocket traffic between the browser and a (possibly NAT'd) agent |
| **oo-api backend** | `https://oo.openonion.ai` | Auth (JWT), agent registry/profile, credits, managed `co/` LLM gateway |
| **Remote agent** | `https://{name}-{addr}.agents.openonion.ai` or relay-routed | The deployed ConnectOnion agent that actually runs the task |

Two identities are in play; don't confuse them:

- **User identity** — the human using oo-chat. A BIP39 mnemonic → Ed25519 keypair
  generated in the browser (`hooks/use-identity.ts`), stored in
  `localStorage['connectonion_keys']`. Its `0x…` public key is the user's account
  with oo-api (credits, auth).
- **Agent address** — the `0x…` public key of the agent you're chatting with. This
  is what you paste into oo-chat and what appears in the URL (`/[address]`).

---

## 3. Identity & auth

`hooks/use-identity.ts` runs on every page (`useIdentity()`), and owns the user's
keypair + session token.

```
mount
  └─ loadBrowser()  → localStorage['connectonion_keys']
        │ found?  ── yes ──▶ use it
        └─ no  ──▶ bip39.generateMnemonic() ──▶ Ed25519 keypair (tweetnacl)
                    └─ saveBrowser() + show recovery phrase modal
  └─ authenticate(keys):
        sign "ConnectOnion-Auth-{address}-{ts}"
          └─ POST /api/auth  ──proxy──▶  POST oo.openonion.ai/api/v1/auth
                └─ { token }                     (JWT)
                     └─ chat-store.setApiKey(token)        // persisted
        GET /api/auth (Bearer token)
          └──proxy──▶ GET oo.openonion.ai/api/v1/auth/me
                └─ { public_key, credits_usd, balance_usd, … }
                     └─ chat-store.setUserProfile(profile)  // persisted
```

`app/api/auth/route.ts` exists only to dodge browser CORS — it forwards to
`NEXT_PUBLIC_OPENONION_API_URL` (default `https://oo.openonion.ai`) and returns the
response verbatim. The JWT (`openonionApiKey`) is later used for credit-metered
features like voice transcription and the managed `co/` LLM gateway.

Identity can be exported/imported/regenerated from `app/settings/page.tsx`
(12/24-word mnemonic, or a 128-hex private key).

---

## 4. Routing & navigation

Three client routes, all wrapped in `ChatLayout` (sidebar + main pane):

```
/                          app/page.tsx
  • No agents → welcome + "paste 0x address" form
  • Has agents → picker grid (name + online dot from useAgentInfo)
  • Pick/add agent ──▶ router.push(`/${address}`)

/[address]                 app/[address]/page.tsx
  • Agent landing: profile from useAgentInfo (name, model, trust, version,
    skills as /slash-commands, tools, accepted inputs)
  • Send first message:
        sessionId = crypto.randomUUID()
        chat-store.createConversation(sessionId, address)
        chat-store.setPendingMessage(content)
        router.push(`/${address}/${sessionId}?mode=…&turns=…`)

/[address]/[sessionId]     app/[address]/[sessionId]/page.tsx
  • The live chat. useAgentSDK({ agentAddress, sessionId }).
  • On mount: apply ?mode from URL, then consumePendingMessage() and send().
  • Streams ChatItem[] → <Chat> renders them.
  • Syncs sidebar title to the first user message.
  • If store hydrated and no conversation + no transcript → redirect to /[address].
```

The first message is deliberately handed off through `pendingMessage` in the store:
the landing page mints the session and navigates, and the session page actually
opens the socket and sends. This keeps the URL shareable (one URL = one session).

---

## 5. Agent discovery & profile

`hooks/use-agent-info.ts` wraps the SDK's `fetchAgentInfo(address)` and polls every
30s (and on tab focus), deduping by value so unchanged data doesn't re-render.

`fetchAgentInfo` (SDK, `src/connect/endpoint.ts`):

```
GET https://oo.openonion.ai/api/relay/agents/{address}
  └─ { endpoints[], relay, last_seen, profile{ name|alias, model, trust,
                                                version, tools[], skills[],
                                                accepted_inputs } }
  • online = Boolean(relay)        // true only while the agent holds a live
                                    //   announce connection to the relay
  • for each endpoint (localhost > private > public):
        GET {endpoint}/info  → if info.address === address, merge as fresher profile
```

Result (`AgentInfo`): `{ address, name?, model?, trust?, version?, tools?, skills?,
accepted_inputs?, online }`. This drives the picker dots, the landing hero, the
skill palette, and the "accepts text/images/files" line.

---

## 6. The live chat connection (the core)

This is the heart of the data flow. oo-chat's `use-agent-sdk.ts` is a thin wrapper;
the SDK's `useAgentForHuman(address, sessionId)` does the work.

### 6.1 Layers

```
app/[address]/[sessionId]/page.tsx
   │  send(text, images?, files?) / respondToAskUser / respondToApproval / setMode / reconnect
   ▼
components/chat/use-agent-sdk.ts            ← oo-chat
   • dedupeUI(ui)                            (collapses duplicate stream items)
   • extractPendingStates(ui)                (derives the "waiting" cards, see §6.5)
   • derives sessionState, isLoading, elapsedTime
   ▼
connectonion/react · useAgentForHuman        ← SDK
   • zustand store per (address, sessionId)  → localStorage co:agent:{addr}:session:{id}
   • agent-cache: reuse a live RemoteAgent (≤6, LRU) across session switches
   ▼
connectonion · RemoteAgent                   ← SDK
   • opens/keeps the WebSocket, signs CONNECT, maps frames → ChatItem[]
   ▼
WebSocket  wss://oo.openonion.ai  (relay)  →  remote agent
```

### 6.2 Connection lifecycle

```
input(prompt)                       // fire-and-forget; UI updates via callbacks
  │ append user ChatItem, status = 'working'
  ▼
_ensureConnected()
  │ open WebSocket, send CONNECT { payload, from, signature, session_id?, to }   (Ed25519, 30s deadline)
  │
  ├── CONNECTED { session_id, status, session?, chat_items? }
  │       status='connected' → idle (ready)      status='running' → keep waiting for live events
  │
  └── ONBOARD_REQUIRED { methods, paymentAmount? }      // trust gate for a stranger
          → user submits invite code / payment → ONBOARD_SUBMIT (signed) → ONBOARD_SUCCESS → CONNECTED
  ▼
send INPUT { input_id, prompt, images?, files? }
  ▼
… stream of frames (thinking / tool_call / tool_result / ask_user / …) → ChatItem[] …
  ▼
OUTPUT { result, session?, chat_items? }   → status = 'idle'; conversation settled
```

### 6.3 Inbound frames (server → client) → ChatItem

The SDK maps each WebSocket frame to a `ChatItem` (the discriminated union the UI
renders). The important ones:

| Frame | Becomes / does | Status |
|-------|----------------|--------|
| `CONNECTED` | resolve connect; sync session/transcript | →idle or waiting |
| `llm_call` / `llm_result` | `thinking` item (running → done, with tokens/cost) | →working |
| `thinking` | `thinking` item (done) | — |
| `assistant` / `agent_image` | `agent` item (markdown / images) | — |
| `tool_call` / `tool_result` | `tool_call` item (running → done, with result) | →working |
| `tool_blocked` | `tool_blocked` item | — |
| `intent` / `eval` / `compact` | `intent` / `eval` / `compact` items | — |
| `files_received` | `files_received` item | — |
| `ask_user` | `ask_user` item | **→waiting** |
| `approval_needed` | `approval_needed` item | **→waiting** |
| `plan_review` | `plan_review` item | **→waiting** |
| `onboard_required` | `onboard_required` item | **→waiting** |
| `ulw_turns_reached` | `ulw_turns_reached` item | **→waiting** |
| `OUTPUT` | settle the turn | **→idle** |
| `ERROR` | set error, close socket | →idle / disconnected |
| `PING` | reply `PONG` (keepalive) | — |
| `session_sync` / `mode_changed` / `SESSION_STATUS` | update session/mode/status | — |

### 6.4 Outbound messages (client → server)

`send()` → `input()`; everything else goes through `sendMessage(...)`:

| Message | Sent when | Shape (key fields) |
|---------|-----------|--------------------|
| `CONNECT` | first connect | `{ payload, from, signature, session_id?, to }` (Ed25519) |
| `INPUT` | user sends a prompt | `{ input_id, prompt, images?, files? }` |
| `ASK_USER_RESPONSE` | answer an `ask_user` | `{ answer }` |
| `APPROVAL_RESPONSE` | approve/reject a tool | `{ approved, scope: 'once'\|'session', mode?, feedback? }` |
| `PLAN_REVIEW_RESPONSE` | respond to a plan | `{ message }` |
| `ULW_RESPONSE` | continue at a ULW checkpoint | `{ action: 'continue'\|'switch_mode', turns?, mode? }` |
| `ONBOARD_SUBMIT` | submit onboarding | signed `{ payload, from, signature, … }` |
| `mode_change` | switch approval mode | `{ mode, turns? }` |
| `SESSION_STATUS` | poll if a session is alive | `{ session: { session_id } }` |
| `PONG` | answer a `PING` | `{ }` |

### 6.5 Approval modes & interactive gates

**Approval mode** (`ApprovalMode = 'safe' | 'plan' | 'accept_edits' | 'ulw'`) is the
trust level for the run. It's seeded from the URL (`?mode=…&turns=N`, set on the
landing page) and can be changed live via `ModeStatusBar` → `setMode()` → the SDK
(which optimistically updates local state and sends `mode_change`).

- `safe` — ask before edits/commands (default)
- `plan` — research first, present a plan for approval
- `accept_edits` — edit without asking
- `ulw` — "ultra-long work": run autonomously for `N` turns, then pause at a checkpoint

**Interactive gates** are frames that put the run into `status = 'waiting'`. The SDK
emits a ChatItem; oo-chat's `extractPendingStates()` turns the *latest unanswered*
one into a `pending*` object that `[sessionId]/page.tsx` passes to `<Chat>`, which
renders the matching card. The user's answer goes back out as the matching message
above:

| Gate (ChatItem) | oo-chat pending state | Response message |
|-----------------|-----------------------|------------------|
| `ask_user` | `pendingAskUser` | `ASK_USER_RESPONSE` |
| `approval_needed` | `pendingApproval` | `APPROVAL_RESPONSE` |
| `plan_review` | `pendingPlanReview` | `PLAN_REVIEW_RESPONSE` |
| `onboard_required` | `pendingOnboard` | `ONBOARD_SUBMIT` |
| `ulw_turns_reached` | `pendingUlwTurnsReached` | `ULW_RESPONSE` |

---

## 7. The event/UI model: ChatItem → component

The SDK's `ui: ChatItem[]` is the single ordered stream the UI renders. `ChatItem`
is a discriminated union on `type` (mirrored in `components/chat/types.ts` as `UI`):

```
user · agent · thinking · tool_call · ask_user · approval_needed ·
onboard_required · onboard_success · intent · eval · compact ·
tool_blocked · ulw_turns_reached · plan_review · files_received
```

`components/chat/chat-messages.tsx` switches on `item.type` and renders the matching
component from `components/chat/messages/`:

```
user            → messages/user.tsx          (markdown + images + files)
agent           → messages/agent.tsx         (markdown + images)
thinking        → messages/thinking.tsx      (collapsible)
tool_call       → messages/tool-call.tsx     ──┐ dispatches by tool name:
                                                ├ bash/shell/run  → BashCard
                                                ├ write/read      → FileCard
                                                ├ edit            → FileDiffCard
                                                ├ grep/glob/find  → GrepCard
                                                ├ ask_user        → LoginCard (fields) / AskUserCard
                                                ├ exit_plan_…     → PlanCard
                                                └ default         → GenericCard
intent/eval/compact/tool_blocked/files_received/onboard_*  → their messages/*.tsx
ulw_turns_reached → chat-ulw-checkpoint.tsx  (interactive)
```

`approval_needed` and `plan_review` are rendered *inline* on the related `tool_call`
card rather than as standalone rows.

---

## 8. State & persistence

Three independent `localStorage` namespaces. The split is deliberate — the
**transcript has exactly one owner (the SDK)**, and the sidebar only keeps an index.

| localStorage key | Owner | Holds | Notes |
|------------------|-------|-------|-------|
| `connectonion_keys` | `hooks/use-identity.ts` | user keypair + mnemonic | the user's identity |
| `oo-chat-storage` | `store/chat-store.ts` (zustand `persist`) | conversation **index**, `agents[]`, JWT, user profile, `activeSessionId` | **no transcript, no images** |
| `co:agent:{address}:session:{id}` | SDK `useAgentForHuman` (zustand) | the **transcript** (`ui`/`messages`/`session`) | one key per session |

### 8.1 Index vs transcript

`chat-store.ts` stores a `Conversation` as `{ sessionId, title, agentAddress,
createdAt }` — just enough to render the sidebar. The actual messages live only in
the SDK's per-session store. On reload, the SDK store hydrates synchronously from
localStorage, so the transcript is already present when `[sessionId]/page.tsx`
mounts — no refetch needed for display. (Older builds kept a second `ui` copy inside
`chat-store`; that's now stripped on read as a migration.)

### 8.2 SDK-side persistence (in `connectonion-ts`)

- **`sanitizeForPersistence`** — before writing, strips base64 data URLs (inline
  images, file `dataUrl`s) so a single conversation can't blow the ~5MB origin quota.
  http(s) image URLs are kept.
- **Session cap** — `MAX_PERSISTED_SESSIONS = 20`. On store open, `pruneOldSessions`
  keeps the 20 most-recently-updated `co:agent:*:session:*` keys and drops the rest.
  The server is the source of truth, so a pruned session re-fetches when reopened.
- **Agent cache** — `MAX_LIVE_AGENTS = 6`. Live `RemoteAgent` WebSocket connections
  are kept in an LRU cache so switching between recent sessions doesn't tear down and
  re-handshake the socket.

---

## 9. What oo-chat actually imports from the SDK

| oo-chat file | Imports | Purpose |
|--------------|---------|---------|
| `components/chat/use-agent-sdk.ts` | `useAgentForHuman`, `ChatItem`, `ApprovalMode` (from `connectonion/react`) | the live chat hook |
| `hooks/use-agent-info.ts` | `fetchAgentInfo`, `AgentInfo`, `SkillInfo`, `AgentAcceptedInputs` | agent profile/online polling |
| `components/chat/chat-input.tsx` | `useVoiceInput` | voice record + transcription (uses the JWT) |
| `components/sidebar.tsx` | `version` (from `connectonion/package.json`) | shows the SDK version |
| `app/api/chat/route.ts` | `createLLM`, `connect`, `address` | **legacy route**, see §10 |

oo-chat pins `connectonion` by semver (`^0.1.x`) for production/Vercel builds, and
symlinks `node_modules/connectonion → ../connectonion-ts` for local development. See
[DEPLOY.md](./DEPLOY.md) for how a change to the SDK reaches production.

---

## 10. Legacy / dead code

- **`app/api/chat/route.ts`** — an older HTTP-POST chat route (agent-`/input`
  signing + a `createLLM()` "Direct LLM" fallback). **Nothing calls it.** The current
  UI talks to agents only through the SDK's WebSocket. Its file header still
  references a removed `use-chat.ts` and a `connectionMode='llm'` `page.tsx`; treat
  the header as historical. Kept (not deleted) to avoid churn; safe to remove if you
  confirm no external caller.
- **`.env.example` LLM keys** — `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` /
  `GEMINI_API_KEY` and `NEXT_PUBLIC_DEFAULT_AGENT_URL` were for that removed mode and
  are unused by the running app. The only env var the app reads is
  `NEXT_PUBLIC_OPENONION_API_URL`.

---

## 11. Configuration & environment

| Var | Default | Used by |
|-----|---------|---------|
| `NEXT_PUBLIC_OPENONION_API_URL` | `https://oo.openonion.ai` | `app/api/auth/route.ts` (auth proxy target) |

Relay (`wss://oo.openonion.ai`) and the relay HTTP API
(`https://oo.openonion.ai/api/relay/...`) are SDK defaults (`ConnectOptions.relayUrl`),
not oo-chat env vars. `next.config.ts` is empty (Next.js 16 defaults; builds use
Turbopack). `vercel.json` only sets `installCommand: npm install`.

---

## 12. One full round trip (worked example)

1. User pastes `0x3d40…` on `/` → `/0x3d40…`. `useAgentInfo` shows the profile.
2. User types "List the files here" → landing mints `sessionId`, stores the message,
   navigates to `/0x3d40…/{sessionId}?mode=safe`.
3. `[sessionId]` mounts → `useAgentForHuman` opens (or reuses) a WebSocket to
   `wss://oo.openonion.ai`, sends a signed `CONNECT`, gets `CONNECTED`, then `INPUT`.
4. Agent streams `intent` → `thinking` → `tool_call(bash: ls)` → `tool_result` →
   `assistant`. Each frame becomes a `ChatItem`; the SDK persists to
   `co:agent:0x3d40…:session:{id}`; oo-chat renders each row.
5. The bash tool needs approval (mode `safe`): `approval_needed` → `status=waiting` →
   oo-chat shows the approval card → user clicks Allow → `APPROVAL_RESPONSE` → run
   resumes.
6. `OUTPUT` settles the turn (`status=idle`). The sidebar title is set from the first
   user message. Reloading the page rehydrates the transcript from localStorage; the
   socket reconnects only if you send again or hit reconnect.

---

## See also

- [`DEPLOY.md`](./DEPLOY.md) — publishing the SDK to npm and shipping oo-chat to Vercel.
- `../connectonion-ts/src/connect/` — `RemoteAgent`, the WebSocket protocol, types.
- `../connectonion-ts/src/react/` — `useAgentForHuman`, the session store, voice input.
