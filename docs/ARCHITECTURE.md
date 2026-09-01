# oo-chat — Architecture & Data Flow

oo-chat is a thin Next.js front end. The SDK does the real work: connecting to an agent,
the WebSocket protocol, and saving the transcript. oo-chat just routes, lays out, and
renders the SDK's stream of events.

oo-chat has one SDK boundary: `@connectonion/react` (`../connectonion-react`). It owns
the React hooks, connection, protocol normalization, browser identity, transcript
persistence, and current session plan. The standalone `connectonion` TypeScript package is not installed by
React applications. `connectonion/react` was the old package subpath and no longer
exists as of `connectonion@0.3.0`.

## One picture

```
   Browser (oo-chat)                                   ConnectOnion
 ┌───────────────────────────────┐
 │  /            pick an agent    │
 │  /[address]   agent profile    │      fetchAgentInfo
 │  /[address]/[sessionId] ◀──────┼──── HTTPS ───▶  oo.openonion.ai
 │        │  live chat            │                 (auth · profile · credits)
 │        ▼                       │
 │  useAgentForHuman()  ← the SDK │      WebSocket (chat + signed session sync)
 │    │           │               │ ───  wss://oo.openonion.ai ──▶  relay ──▶  the agent
 │    ▼           ▼               │
 │  Chat        Home (iframe)     │      Home = the agent's own dashboard.html,
 └────┼──────────────────────────┘       pushed over the same socket
      ▼  local cache
   keypair · sidebar index · transcript
```

## The flow, start to finish

1. You paste an agent's `0x…` address → the app shows its profile
   (`fetchAgentInfo`, from the relay).
2. You send a message → the app mints a `sessionId` and opens `/[address]/[sessionId]`.
3. That page calls the SDK's `useAgentForHuman(address, sessionId)`, which opens a
   WebSocket to the relay (`wss://oo.openonion.ai`) and sends your message.
4. The agent streams back events — thinking, tool calls, results, questions. The SDK
   turns conversational events into `ChatItem` rows and exposes the latest Todo List
   separately; oo-chat renders that progress outside the transcript.
5. If the agent needs you (approve a command or answer a question), the
   run pauses and a card appears; your reply goes back over the same socket.
6. If you press Stop, O Chat updates the UI immediately and calls the React package's
   `interrupt()` operation. React owns session binding and protocol selection.
7. When the turn ends, the SDK has already cached the transcript in localStorage and
   the Agent Host has retained the canonical session. Reload restores the local copy
   instantly.
8. A separate authenticated index connection reconciles Recent Chat with the Host on
   load, every 15 seconds, and on focus, visibility, or online events. It creates no
   chat session of its own. Another device therefore sees committed conversations
   without sharing browser storage.

## Two ideas that explain the rest

**1 · One connection path.** Everything is agent ↔ browser over a single WebSocket
through the SDK. Each session has one canonical mode: `read-only`, `auto`, or
`full-access`. Fresh sessions and unrecognized persisted values resolve to `auto`.
The Todo List is progress only and never grants authority. (An old HTTP
"Direct LLM" mode is gone, and so is the
`app/api/chat` route that served it.)

**2 · Authority vs caches.** The Agent Host is authoritative for retained sessions.
The browser has two caches with narrower jobs: the SDK transcript makes the current
device fast, while the sidebar index makes navigation immediate and keeps local drafts
that have not reached the Host yet.

| localStorage key | Owner | Holds |
|---|---|---|
| React secure identity store (IndexedDB) | `@connectonion/react` | non-extractable Ed25519 key; recovery material is never persisted |
| `oo-chat-storage` | `chat-store` | cached sidebar index + local drafts + agents — **no messages or credentials** |
| `oo-chat:session-sync:v1:{identity}:{addr}` | O Chat | opaque Host cursor; no chat content |
| `co:agent:{addr}:session:{id}` | the SDK | cached transcript (capped at 20 sessions) |

The OpenOnion auth JWT and account profile are runtime-only. On reload the
React-owned identity signs a fresh authentication request; hydration also
removes JWT/profile fields written by older O Chat alpha stores.

## Where things live

| Path | Role |
|---|---|
| `app/page.tsx` | pick / add an agent |
| `app/[address]/page.tsx` | agent profile + first message |
| `app/[address]/[sessionId]/page.tsx` | the live chat |
| `components/chat/use-agent-sdk.ts` | wraps the SDK hook; derives the "waiting" cards |
| `components/chat/chat-messages.tsx` | `ChatItem.type` → message component |
| `components/current-plan-panel.tsx` | renders the SDK's current plan; no protocol parsing or actions |
| `components/dashboard/workspace-shell.tsx` | the Chat + Home split, and the mobile switch |
| `components/dashboard/dashboard-pane.tsx` | the Home iframe + the button→skill bridge |
| `components/dashboard/build-srcdoc.ts` | wraps agent HTML with the CSP and bridge |
| `hooks/use-identity.ts` | your keypair + login |
| `hooks/use-agent-info.ts` | agent profile + online status (cache-first; refetch on tab focus) |
| `hooks/use-recent-chat-sync.ts` | owner-scoped Host history reconciliation and archive operations |
| `store/chat-store.ts` | the sidebar index |
| `app/api/auth/route.ts` | CORS proxy to `oo.openonion.ai` for login |

oo-chat imports `useAgentForHuman`, `fetchAgentInfo`, and `useVoiceInput` from
`@connectonion/react` (`../connectonion-react`). Shipping that package is documented in
[DEPLOY.md](./DEPLOY.md).

## Recent Chat synchronization

The index connection negotiates the OIP Session Sync extension and signs every command
with the same browser identity used for chat. The Host returns only sessions owned by
that identity. Cursors are opaque and incremental: O Chat stores the latest cursor per
identity and Agent Address, applies changed summaries, and removes remotely archived or
expired rows. If a cursor expires after Host compaction, it discards the cursor and
performs a full reconciliation.

Remote revisions win over stale local summaries. Local-only drafts remain until their
first turn is committed. Archive is a revision-checked Host update; on one conflict O
Chat merges the returned current summary and retries once. Older Hosts that do not
advertise Session Sync stay local-only for that page lifetime, so this release remains
backward compatible.

The index connection uses `sessionSyncOnly`, so opening O Chat does not create an empty
Agent session merely to populate the sidebar. Route guards wait for the first sync
attempt before treating a missing remote row as nonexistent.

## Home — the agent's dashboard

Beside the chat, oo-chat renders the agent's own **Home page**: a `dashboard.html` the
agent keeps in its project root. The host reads that file and pushes it over the same
WebSocket the chat uses, so there's nothing to fetch — `dashboardHtml` from the SDK
hook simply has a value, on connect and again after any run that changed the file.

`WorkspaceShell` lays out both panes: side by side on desktop (Home collapsible),
one at a time on mobile behind a `Home | Chat` switch. Each pane renders **once** and
is shown or hidden with CSS — mounting the chat twice would open a second SDK
subscription.

Plenty of agents have no dashboard, and nothing on the wire says so — there's only the
absence of a snapshot. So `hasDashboard` gates the whole Home side: no snapshot, no
pane and no switch, rather than a placeholder that never resolves.

The landing page connects eagerly to a **draft session**, so Home can paint before you
type anything. Sending promotes that draft into the real session, and the already-open
socket carries over. A draft you abandon is cleared on unmount — otherwise every visit
would leak an open socket and consume one of the SDK's 20 persisted-session slots.

### The page is untrusted

`dashboard.html` is written by the agent. Treat it like any remote document — two
browser-enforced layers, no sanitizer:

1. **`sandbox="allow-scripts"`** (without `allow-same-origin`) gives the frame an
   opaque origin. It cannot read oo-chat's `localStorage`, your keys, or the parent DOM,
   and cannot navigate the top window.
2. **A CSP with a per-render nonce** — `default-src 'none'; style-src 'unsafe-inline';
   img-src data:; font-src data:; script-src 'nonce-…'`. Only our bridge script runs;
   the agent's `<script>` tags and inline `onclick` handlers don't, and `default-src
   'none'` means the page can't reach the network at all.

`build-srcdoc.ts` **wraps** the agent's HTML rather than editing it: our `<head>`
(charset, viewport, CSP, bridge) comes first, the agent's markup goes in the body
verbatim. This matters. Injecting the CSP by string-matching `<head>` is defeatable — a
`<head>` inside a comment moves the meta into that comment and drops the policy
entirely, leaving the sandbox as the only layer. Browsers discard a nested
`<html>`/`<head>`/`<body>` and keep the children, so a full agent document renders
unchanged, and a CSP the agent declares itself can only intersect with ours. The bridge
sits in `<head>` too, ahead of the agent's bytes, so unterminated markup can't swallow
it.

### Buttons

A button in the page declares a skill:

```html
<button data-ochat-skill="daily-brief" data-ochat-args="today">Build my brief</button>
```

The bridge posts `{skill, args}` to the parent, and `DashboardPane` treats that as
**untrusted intent**: it checks the event source is our iframe, shape-checks the name,
and requires the skill to be in the agent's published list — failing closed while that
list is still loading. It then runs it through the normal send path, so the most a
forged message can do is produce a visible `/skill` turn you can see. Only project
skills are published, so a button naming a user or builtin skill won't run.

### A dashboard doesn't link out

A Home page is **one self-contained page**. Everything it shows is inlined (the CSP
blocks external subresources anyway) and its only action is running a skill, so there
is nothing legitimate to navigate to. The bridge cancels any click on an `<a href>`
that isn't a same-page fragment.

That's a product decision first, but it also closes a hole. Neither the CSP nor the
sandbox stops a frame from navigating **itself** — `frame-src` governs nested frames,
and no browser shipped `navigate-to`. A link would replace Home with a document under
its own CSP, where scripts and network are allowed again. It stays sandboxed (opaque
origin, no forms, no popups, no top navigation) so it can't reach oo-chat's storage or
keys, but it could render a convincing fake and exfiltrate whatever the user typed in.
`DashboardPane` keeps a backstop for navigation a click handler can't intercept — a
`<meta http-equiv="refresh">`, say: the frame should load exactly once per snapshot, so
a second load swaps the pane for a "tried to navigate away" notice instead of the
destination.

**If dashboards ever need external links, this is the contract to revisit — and it
isn't a one-line change.** Allowing navigation means deciding what the frame may
navigate to, and either keeping the destination inside the sandbox (where it still
can't be trusted) or opening it in a real tab, which needs `allow-popups` and a
rel-safe `target="_blank"` path. Loosening the click handler on its own just re-opens
the hole above.

`build-srcdoc.test.ts` covers this boundary: the CSP and bridge must survive hostile
documents (`<head>` in comments, unterminated attributes, the agent's own CSP meta),
and links must be cancelled. Run it with `npm test`.

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
the host publishes a `balance_usd` snapshot in its ANNOUNCE profile / `/info`, the SDK
surfaces it on `AgentInfo` (`fetchAgentInfo`), and oo-chat
shows it **per agent in Settings** (a startup snapshot, refreshed when the agent
restarts — not a live figure). Non-`co/*` agents publish no balance and simply show none.

## Configuration

One optional env var: `NEXT_PUBLIC_OPENONION_API_URL` (default `https://oo.openonion.ai`,
the auth/profile backend). The relay URL is an SDK default. `next.config.ts` is empty.

---

## Reference — the WebSocket protocol

*Skip this unless you're working on the agent connection itself.* The React SDK
(`connectonion-react/src/connect/`) owns it; here's the shape.

**Connect → run → settle:** the SDK sends a signed `CONNECT` (a stranger may first
hit an `ONBOARD_REQUIRED` trust gate), then `INPUT { prompt }`. The agent streams
events until `OUTPUT` settles the turn. `PING`/`PONG` keep the socket alive.

**Streamed events → `ChatItem`** (rendered by `chat-messages.tsx`):
`thinking` (llm_call/result), `agent` (assistant/image), `tool_call` (+`tool_result`),
`tool_blocked`, `intent`, `eval`, `compact`, `files_received`.

**Current Todo List → `PlanEntry[]`** (rendered by `current-plan-panel.tsx`): the SDK
normalizes full replacements and empty clears per session. It is observational state,
not a `ChatItem` and never an authority control.

**Interactive gates** pause the run (`status = 'waiting'`) until you respond:

| Gate (from agent) | Card shown | Your reply (to agent) |
|---|---|---|
| `ask_user` | question / form | `ASK_USER_RESPONSE` |
| `approval_needed` | allow/deny a tool | `APPROVAL_RESPONSE` |
| `onboard_required` | invite code / payment | `ONBOARD_SUBMIT` |

While idle, O Chat renders only Host-advertised canonical modes. It calls
React's `setSessionMode`; React owns OIP acknowledgement, timeout, and reconnect.
Full access is bounded by the Host's positive `turns_left`, remains user-driven,
and does not create a browser continuation action. O Chat constructs no transport
frames and cannot author a Full access turn limit. `SESSION_STATUS` checks whether a session
is still alive on the relay. `DASHBOARD_SNAPSHOT { html }` carries the agent's Home page
— sent right after `CONNECTED`, and again after a run that changed the file.

Stopping a turn is deliberately not a wire concern in O Chat. The app calls
`interrupt()` and updates its optimistic presentation; `@connectonion/react` sends the
OIP `INTERRUPT` frame. Application code must not construct the cancellation frame.
Approval responses follow the same ownership
rule: O Chat selects a product decision and React correlates and encodes the response.

**SDK persistence details:** before writing, the SDK strips base64 data URLs (images)
so a conversation can't blow the ~5MB quota; it keeps the 20 most-recent sessions and
caches up to 6 live sockets so switching sessions doesn't re-handshake.
