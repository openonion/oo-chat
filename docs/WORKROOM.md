# Native Coding Work Room

The Work Room is the browser presentation for one active native coding-provider
invocation. It supports the OIP-only Codex and Claude Code adapters. It is not an
ACP compatibility view, a browser-side provider adapter, or a terminal emulator.

## Cross-layer ownership

```text
Codex / Claude native events
        │
        ▼
ConnectOnion Core native adapters and Host session UI
        │  typed OIP provider_invocation / provider_activity / provider_artifact / provider_approval
        ▼
@connectonion/react normalizer and provider Stop acknowledgement
        │  bounded reader state
        ▼
O Chat compact card + Work Room
```

| Layer | Owns | Primary references |
| --- | --- | --- |
| Core | Provider-to-OIP translation, scope validation, Stop authority and terminal lifecycle | `connectonion/core/provider_events.py`, `connectonion/network/host/session/ui.py`, `connectonion/useful_tools/codex.py`, `connectonion/useful_tools/claude_code.py` |
| React SDK | WebSocket/OIP parsing, compatibility normalization, correlated provider Stop acknowledgement | `connectonion-react/src/connect/remote-agent.ts`, `connectonion-react/src/use-agent-for-human.ts` |
| O Chat | Safe rendering, focus and scroll behavior, and local UI lifecycle only | `components/chat/use-agent-sdk.ts`, `components/chat/messages/coding-agent-card.tsx`, `components/chat/messages/coding-agent-workroom.tsx` |

The protocol design and any cross-layer change are tracked in
[connectonion#1109](https://github.com/openonion/connectonion/issues/1109). The
product acceptance issue is [oo-chat#180](https://github.com/openonion/oo-chat/issues/180).

## Reader-facing contract

The transcript card is intentionally small:

- provider, safe task title, current semantic status/result, and one action;
- no raw prompts, commands, working directory, session IDs, output, provider
  frames, or simulated terminal/screenshot;
- a pending approval becomes one **Review decision** action. The approval remains
  in the Work Room, where scope and reason are visible before an allow action.

The Work Room is one vertically scrolling detail surface:

1. an approval, if the authoritative provider state is awaiting approval;
2. one optional, real provider preview for the current state;
3. one current-progress card with latest completed semantic evidence;
4. an explicit activity-history disclosure in the same page scroll.

Only a typed, safe `provider_artifact` may render a visual preview. Text, command
activity, or an absent artifact must never be made to look like a Codex
screenshot. Until the protocol supplies one, the intentionally text-only card is
correct rather than incomplete.

### Preview acceptance contract

A preview is evidence, not decoration. It appears only when all of the following
are true:

- Core has captured a real Host-owned workspace or browser raster rather than
  provider text or a synthetic UI image;
- its `provider`, invocation ID, parent tool-call ID, and positive
  `stateRevision` identify the same lifecycle state currently on screen;
- it is an inline PNG or JPEG no larger than 256 KiB, with valid image bytes and
  one of two finite alt labels; and
- Core, React, and O Chat each revalidate the boundary before replaying or
  rendering it.

The compact card shows at most one small current preview and still has exactly
one action. The Work Room shows the same current preview above progress. A newer
provider state, a reconnect replay, missing capture, or unsafe data removes the
preview rather than retaining a stale image. Native Codex and Claude Code do not
yet emit screen captures on their own, so this release deliberately shows no
invented thumbnail until a Host capture producer is enabled.

## Scoped Stop lifecycle

The provider Stop button addresses the invocation selected in the Work Room, not
the outer agent turn. The state owner is `useAgentSDK` in production and
`CodingAgentCard` for an embedded card host:

```text
click Stop → requesting → Host ACK → acknowledged → terminal provider event
                                            │
                                            └─ no terminal event within 15 s → unconfirmed
```

- **requesting**: disable the same Stop button and say that Host confirmation is
  pending; do not call it stopped yet.
- **acknowledged**: hide stale approval and generic thinking/outer Stop controls;
  show a calm `Stop requested` state until the provider sends a terminal frame.
- **unconfirmed**: fail closed. Hide approval and Stop controls, retain the last
  reported semantic progress, and explain that provider state needs confirmation.
- **terminal**: Core/OIP is authoritative and restores ordinary controls.

Every semantic provider lifecycle event carries a positive, per-invocation
`stateRevision`. A Stop request includes the revision observed by the browser,
and the Host ACK echoes it only when it addressed that exact live state. React
rejects missing, mismatched, unversioned, or older acknowledgements; it also
preserves a newer rendered revision over an older reconnect snapshot. A newer
correlated provider event releases the Stop barrier, while an equal or stale
event cannot silently revive actions or attach an older preview.

## Work Room completion standard

The feature is ready for a preview release only when a long native Codex run can
be observed as a calm, truthful product surface:

- a C task takes at least eight semantic steps, including edit, compile, run,
  test, inspect, and an approval decision;
- the transcript remains scannable in five seconds: provider, task, current
  state, one summary, and one entry action; raw prompts and terminal output stay
  out of it;
- the Work Room has one page scroll, one conditional primary decision, one
  current progress statement, and hidden history; and
- desktop and 375px mobile screenshots show no horizontal overflow, clipped
  controls, stale Stop state, duplicate verification UI, or fabricated preview.

## Acceptance evidence

The maintained E2E scenario asks Codex to create `sort.c` and `test_sort.c`,
compile under `-std=c11 -Wall -Wextra -Werror`, run several fixtures and tests,
then inspect the result. It covers:

- 8 semantic activities, folded history, raw-data redaction and mobile width;
- a scoped approval and narrow allowed scope;
- normal Stop, delayed Host ACK, rejected ACK, and ACK with no terminal provider
  event, plus a newer correlated state after a Stop;
- completion and failure states; keyboard focus and return-to-card behavior.

The unit suites also prove the preview contract: only the current revision's
bounded PNG/JPEG can render, and an invalid or stale artifact disappears.

Run it with:

```bash
npm run e2e -- e2e/coding-agent-card.spec.ts --project=chromium
```

Every O Chat PR must also include a real E2E screenshot visibly embedded in its
body. `.github/workflows/e2e.yml` checks that declaration, while artifacts retain
the full screenshot set for review.
