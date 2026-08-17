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
3. one current-progress card with one latest completed semantic update distinct
   from the current running phase;
4. an explicit activity-history disclosure in the same page scroll.

### Information hierarchy and approval decision

The primary question is always **what is the provider doing now?** The compact
card therefore contains one status, one task title, one semantic summary, an
optional small current preview, and one action. It never grows into a second
transcript or terminal. In the Work Room, progress remains the primary reading
surface; a verified provider view is supporting evidence and is height-bounded
(224px on narrow screens and 256px on larger screens) so it cannot push current
progress below the first useful view.

An approval deliberately does **not** get direct Allow/Reject buttons inside the
compact card. The card becomes a high-emphasis **Review decision** entry point.
The Work Room is the sole decision surface, where the action, reason, scope and
affected files can be read together. Duplicating approval controls on a compact,
possibly stale card would create two authority surfaces and make it easier to
approve without the security context. This is the product decision recorded in
[oo-chat#187](https://github.com/openonion/oo-chat/issues/187), alongside the
native protocol work in [connectonion#1109](https://github.com/openonion/connectonion/issues/1109).

Only a typed, safe `provider_artifact` may render a visual preview. Text, command
activity, or an absent artifact must never be made to look like a Codex
screenshot. Until the protocol supplies one, the intentionally text-only card is
correct rather than incomplete.

### Preview acceptance contract

A preview is evidence, not decoration. It appears only when all of the following
are true:

- Core has captured a real native-provider raster rather than provider text or
  a synthetic UI image;
- its `provider`, invocation ID, parent tool-call ID, and positive
  `stateRevision` identify the same lifecycle state currently on screen;
- it is an inline PNG or JPEG no larger than 256 KiB, with valid image bytes and
  one of two finite alt labels; and
- Core, React, and O Chat each revalidate the boundary before replaying or
  rendering it.

The compact card shows at most one small current preview and still has exactly
one action. The Work Room shows the same current preview above progress. A newer
provider state, a reconnect replay, missing capture, or unsafe data removes the
preview rather than retaining a stale image. Codex may emit a completed native
`imageView` for a regular PNG/JPEG inside its workspace; Claude Code may emit an
actual inline PNG/JPEG image block. Core validates and bounds either form before
it becomes OIP evidence. Neither adapter fabricates a thumbnail from terminal
text, a URL, SVG, or an arbitrary local path.

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

The browser persists this current-tab reader barrier across a reload. An
acknowledged barrier retains its expiry and revision; an in-flight `requesting`
barrier deliberately reopens as **unconfirmed**, because a reload cannot prove
that the Host received it. A newer correlated lifecycle revision or a terminal
provider frame resolves the barrier; a stale replay cannot.

Legacy React clients may not expose a provider revision at all. Their
`unconfirmed` barrier is still persisted and stays fail-closed until a terminal
provider frame; it is never discarded merely because a revision was absent.

The record is an availability aid, not authority. Missing storage means no Stop
was recorded; malformed, duplicate, unavailable, or unwritable storage is
**untrusted**. In that case O Chat marks every live native invocation as
`Status needs confirmation`, hides its approval and Stop controls, and waits
for a newer provider revision or a terminal provider frame. It never treats a
failed decode as an empty, safe barrier.

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
  current progress statement, one latest activity, and hidden history; and
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

Every O Chat PR must also include real E2E screenshots visibly embedded in its
body. For a changed visible surface, the PR records Before (or a concrete
new-surface reason), After desktop, After 375–390px mobile, applicable critical
states, Core/React versions, and the exact final O Chat head SHA that generated
the evidence. `.github/workflows/e2e.yml` rechecks that declaration on PR body,
label, and head changes; artifacts retain the full screenshot set for debugging,
but never substitute for inline review.

An internal/test/dependency-only change can be waived only when a maintainer
applies `no-visual-change` and the author explains why rendering cannot differ.
The label is a controlled exception, not a self-declared checkbox. The gate does
not attempt to judge visual quality automatically: it verifies evidence scope
and provenance, then leaves usefulness and design quality to human review.

## UI review: top ten checks for every visible iteration

Before changing a visible Work Room flow, the PR author records the result of
these ten checks in the PR template and attaches the corresponding E2E frame.
This makes visual review a release input rather than a post-merge impression.

| # | Review question | Evidence |
| --- | --- | --- |
| 1 | Does the compact card still communicate provider, task, current status and one semantic summary in five seconds? | Desktop card screenshot and card test |
| 2 | Is there still exactly one compact-card action? | Card test; approval state uses **Review decision** |
| 3 | Are raw prompts, commands, paths, IDs, files and provider frames absent from the card? | Redaction assertions and screenshot |
| 4 | Does a preview render only when it is current, bounded and real provider evidence? | Current/stale-artifact unit cases and screenshot |
| 5 | Does Work Room show approval (when present), current progress and latest completed activity without competing panels? | Long-run Work Room screenshot |
| 6 | Is older activity hidden until the reader explicitly opens history? | Activity-history E2E |
| 7 | Does Stop remain scoped, acknowledge honestly, and fail closed after an ambiguous reload or ACK? | Stop lifecycle E2E |
| 8 | Do completion, failure and unconfirmed states avoid implying success or renewed permission? | Terminal and reconnect E2E |
| 9 | At desktop width, are task, Stop, preview and progress legible without an oversized preview or a clipped control? | Desktop screenshot |
| 10 | At 375px, are the primary action, approval, back navigation and history control reachable with no horizontal overflow? | Mobile screenshot and keyboard assertions |
