# oo-chat — Architecture & Data Flow

oo-chat is a thin Next.js front end. The `connectonion` TypeScript SDK
(`../connectonion-ts`) does the real work: connecting to an agent, the WebSocket
protocol, and saving the transcript. oo-chat just routes, lays out, and renders the
SDK's stream of events.

## One picture

```
   Browser (oo-chat)                                   ConnectOnion
 ┌───────────────────────────────┐
 │  /            pick an agent    │
 │  /[address]   agent profile    │      fetchAgentInfo
 │  /[address]/[sessionId] ◀──────┼──── HTTPS ───▶  oo.openonion.ai
 │        │  live chat            │                 (auth · profile · credits)
 │        ▼                       │
 │  useAgentForHuman()  ← the SDK │      WebSocket
 │        │                       │ ───  wss://oo.openonion.ai ──▶  relay ──▶  the agent
 └────────┼──────────────────────┘
          ▼  localStorage
   keypair · sidebar index · transcript
```

## The flow, start to finish

1. You paste an agent's `0x…` address → the app shows its profile
   (`fetchAgentInfo`, from the relay).
2. You send a message → the app mints a `sessionId` and opens `/[address]/[sessionId]`.
3. That page calls the SDK's `useAgentForHuman(address, sessionId)`, which opens a
   WebSocket to the relay (`wss://oo.openonion.ai`) and sends your message.
4. The agent streams back events — thinking, tool calls, results, questions. The SDK
   turns each into a `ChatItem`; oo-chat renders each as a row.
5. If the agent needs you (approve a command, answer a question, review a plan), the
   run pauses and a card appears; your reply goes back over the same socket.
6. When the turn ends, the SDK has already saved the transcript to localStorage.
   Reload restores it instantly; the socket reconnects only when you send again.

## Two ideas that explain the rest

**1 · One connection path.** Everything is agent ↔ browser over a single WebSocket
through the SDK. The "modes" (`safe` / `plan` / `accept_edits` / `ulw`) are *trust
levels*, not connection types. (An old HTTP "Direct LLM" mode is gone —
`app/api/chat/route.ts` is dead code.)

**2 · Index vs transcript.** Two stores, on purpose — the transcript has exactly one
owner (the SDK); the sidebar store just lists conversations:

| localStorage key | Owner | Holds |
|---|---|---|
| `connectonion_keys` | `use-identity` | your keypair (BIP39 → Ed25519) |
| `oo-chat-storage` | `chat-store` | sidebar index + agents + token — **no messages** |
| `co:agent:{addr}:session:{id}` | the SDK | the actual transcript (capped at 20 sessions) |

## Where things live

| Path | Role |
|---|---|
| `app/page.tsx` | pick / add an agent |
| `app/[address]/page.tsx` | agent profile + first message |
| `app/[address]/[sessionId]/page.tsx` | the live chat |
| `components/chat/use-agent-sdk.ts` | wraps the SDK hook; derives the "waiting" cards |
| `components/chat/chat-messages.tsx` | `ChatItem.type` → message component |
| `hooks/use-identity.ts` | your keypair + login |
| `hooks/use-agent-info.ts` | agent profile + online status (polls every 30s) |
| `store/chat-store.ts` | the sidebar index |
| `app/api/auth/route.ts` | CORS proxy to `oo.openonion.ai` for login |

oo-chat imports `useAgentForHuman`, `fetchAgentInfo`, and `useVoiceInput` from the
SDK. The SDK lives in `../connectonion-ts`; shipping it is in [DEPLOY.md](./DEPLOY.md).

## Identity & login

First load generates a recovery phrase → Ed25519 keypair (your account). The app
signs a message, posts it to `/api/auth` (a proxy to `oo.openonion.ai`), and gets a
JWT — used for voice transcription and login. Back it up from **Settings**. This key
is a communication/auth identity, **not an agent**: it runs no LLM calls and pays for
no agent usage. The agent you chat with has its own `0x…` address; don't confuse the two.

## Balance

Credits are spent by the **agent** you connect to (it runs `co/*` on managed keys and
deducts from *its* OpenOnion account), not by your browser identity. Balance is
per-address and gated by that address's private key, so the frontend — which only holds
its own key — can't query an agent's balance directly. Instead the agent reports it:
the host publishes a `balance_usd` snapshot in its ANNOUNCE profile / `/info`
(`connectonion`), the SDK surfaces it on `AgentInfo` (`fetchAgentInfo`), and oo-chat
shows it **per agent in Settings** (a startup snapshot, refreshed when the agent
restarts — not a live figure). Non-`co/*` agents publish no balance and simply show none.

## Configuration

One optional env var: `NEXT_PUBLIC_OPENONION_API_URL` (default `https://oo.openonion.ai`,
the auth/profile backend). The relay URL is an SDK default. `next.config.ts` is empty.

---

## Reference — the WebSocket protocol

*Skip this unless you're working on the agent connection itself.* The SDK
(`connectonion-ts/src/connect/`) owns it; here's the shape.

**Connect → run → settle:** the SDK sends a signed `CONNECT` (a stranger may first
hit an `ONBOARD_REQUIRED` trust gate), then `INPUT { prompt }`. The agent streams
events until `OUTPUT` settles the turn. `PING`/`PONG` keep the socket alive.

**Streamed events → `ChatItem`** (rendered by `chat-messages.tsx`):
`thinking` (llm_call/result), `agent` (assistant/image), `tool_call` (+`tool_result`),
`tool_blocked`, `intent`, `eval`, `compact`, `files_received`.

**Interactive gates** pause the run (`status = 'waiting'`) until you respond:

| Gate (from agent) | Card shown | Your reply (to agent) |
|---|---|---|
| `ask_user` | question / form | `ASK_USER_RESPONSE` |
| `approval_needed` | allow/deny a tool | `APPROVAL_RESPONSE` |
| `plan_review` | approve a plan | `PLAN_REVIEW_RESPONSE` |
| `onboard_required` | invite code / payment | `ONBOARD_SUBMIT` |
| `ulw_turns_reached` | continue autonomous run | `ULW_RESPONSE` |

Switching mode mid-run sends `mode_change`. `SESSION_STATUS` checks whether a session
is still alive on the relay.

**SDK persistence details:** before writing, the SDK strips base64 data URLs (images)
so a conversation can't blow the ~5MB quota; it keeps the 20 most-recent sessions and
caches up to 6 live sockets so switching sessions doesn't re-handshake.
