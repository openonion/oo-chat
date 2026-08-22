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
        │  typed OIP provider_invocation / provider_activity / provider_artifact /
        │  provider_message / provider_approval
        ▼
@connectonion/react normalizer and correlated native acknowledgements
        │  bounded reader state
        ▼
O Chat compact card + Work Room
```

| Layer | Owns | Primary references |
| --- | --- | --- |
| Core | Provider-to-OIP translation, scope validation, direct Codex turn ownership, Stop authority and terminal lifecycle | `connectonion/core/provider_events.py`, `connectonion/network/host/session/ui.py`, `connectonion/useful_tools/codex.py`, `connectonion/useful_tools/claude_code.py` |
| React SDK | WebSocket/OIP parsing, compatibility normalization, correlated provider Stop and direct-input acknowledgement | `connectonion-react/src/connect/remote-agent.ts`, `connectonion-react/src/use-agent-for-human.ts` |
| O Chat | Safe rendering, focus and scroll behavior, and local UI lifecycle only | `components/chat/use-agent-sdk.ts`, `components/chat/messages/coding-agent-card.tsx`, `components/chat/messages/coding-agent-workroom.tsx` |

The protocol design and any cross-layer change are tracked in
[connectonion#1109](https://github.com/openonion/connectonion/issues/1109). The
product acceptance issue is [oo-chat#180](https://github.com/openonion/oo-chat/issues/180).

## Reader-facing contract

The transcript card is intentionally small:

- provider, safe task title, current semantic status/result, and one action;
- no raw prompts, commands, working directory, session IDs, output, provider
  frames, or simulated terminal/screenshot;
- a verified native approval is the only exception to that one-action rule: it
  adds one compact, correlated decision strip with its safe action, scope,
  reason and risk. It can offer a bounded **Allow once**, **Reject this
  request**, and a quiet **Review details in Work Room** link. Missing,
  ambiguous, elevated or unverified approvals fail closed rather than creating
  a shortcut to broader trust.

The Work Room is one vertically scrolling detail surface:

1. an approval, if the authoritative provider state is awaiting approval; in
   that state it is the only active surface — there is no empty conversation,
   passive activity panel, or disabled composer competing with the decision;
2. otherwise, recent native Codex conversation or one real current preview
   appears only when it has evidence; it shares the same continuous Work Room
   content flow as the current state, rather than becoming another boxed panel;
3. one compact current-status sentence and, only while a different later
   activity is running, one short **Last completed** result in the same reading
   unit; there is no duplicate progress meter, step counter, or repeated
   “latest” panel;
4. an explicit earlier-activity disclosure in the same page scroll; and
5. for Codex outside a pending decision, a fixed footer composer that sends
   directly to the native thread.

### Information hierarchy and approval decision

The primary question is always **what is happening in this native session now?**
The compact card therefore contains one status, one task title, one semantic
summary, an optional current thumbnail, and one action. It never grows into a
second transcript or terminal. In the Work Room, a short current-status sentence
comes first, followed by the native conversation and any verified provider view
in one continuous content stream. A provider view uses `object-contain`, so the
whole capture stays visible. The UI does not repeat the current state as a
counter, a progress meter, a latest-step card, and a separate conversation card.
During a long running task it may add one different, completed semantic result
as a quiet second line; this is evidence of progress, not a second activity feed.

For an authoritative, correlated native approval, the compact card includes a
small direct decision strip. It exposes only the action, scope, reason and risk
needed to decide; raw commands, paths, IDs, output and file lists stay hidden.
The strip and Work Room consume the same `providerApproval` identity and shared
resolution state, so a decision in either surface immediately settles both.
The card can offer **Allow once** only for a verified `workroom` scope; broader,
unknown or unverified requests never gain a card allow action. It cannot grant
session trust, Full access, or infer authority from a URL, card state or local
storage. Work Room remains the detailed review surface for affected files,
session trust and optional rejection paths. This safety-critical compact
exception is the product decision in
[oo-chat#180](https://github.com/openonion/oo-chat/issues/180), superseding the
earlier single-surface direction in
[oo-chat#187](https://github.com/openonion/oo-chat/issues/187).

The strip uses the existing neutral palette rather than a one-off warning
colour. Scope and risk stay distinct through explicit language, hierarchy and
weight, which keeps a normal bounded approval legible without turning the
conversation into a second alert system.

When Host clears a pending approval before the next provider lifecycle frame,
O Chat retains only that safe semantic presentation and its resolved state for
the matching invocation. The strip stays settled, never re-enables a button,
and disappears on a new approval, Stop barrier or terminal/provider transition.
It does not retain raw approval arguments during that bridge.

While such a decision is open, it replaces passive Work Room content rather than
being stacked above it. A disabled message box, an empty “Live session” panel,
or a secondary status/history card all make the person scan irrelevant controls
when they need to make one bounded choice. Once the native provider moves to a
new state, the ordinary current-session hierarchy returns.

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
one action. The Work Room shows the same current preview in the native session
flow at a bounded 16:9 surface. A newer provider state, a reconnect replay,
missing capture, or unsafe data removes the preview rather than retaining a
stale image. Codex may emit a completed native
`imageView` for a regular PNG/JPEG inside its workspace; Claude Code may emit an
actual inline PNG/JPEG image block. Core validates and bounds either form before
it becomes OIP evidence. Neither adapter fabricates a thumbnail from terminal
text, a URL, SVG, or an arbitrary local path.

## Direct Codex conversation

The Work Room composer is not the outer chat composer. It sends a signed OIP
`PROVIDER_INPUT` frame for the exact Codex invocation and `stateRevision` on
screen. Core routes it in one of two native-only ways:

- while the invocation is live, Codex receives `turn/steer` for its active
  native turn;
- after a terminal invocation, Host atomically claims the caller's own durable
  Codex thread, resumes it, and starts a new native turn directly. It does not
  call `Agent.input()` or ask the outer COAI model to interpret the message.

The browser keeps its draft until it receives a matching accepted
`PROVIDER_INPUT_ACK`. A Host mailbox enqueue or worker start is not enough: Core
emits a positive ACK only after `turn/steer` succeeds or after the resumed native
`turn/start` succeeds. A native race or timeout therefore leaves the text in the
composer for an honest retry. The visible user and assistant messages are bounded
plain-text `provider_message` events; raw commands, paths, and output remain out
of the conversation.

The default composer deliberately stays to one text field and one send action.
It never adds hidden instructions or raw provider output to OIP.

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
  state, one summary, and one entry action; a verified pending approval is the
  narrow exception, presenting only its bounded direct decision strip. Raw
  prompts and terminal output stay out of it;
- outside a decision, the Work Room has one page scroll, one continuous current
  state / native-session flow, at most one distinct **Last completed** result,
  an evidence-bearing preview only when one exists, and hidden earlier activity;
  a decision instead becomes the sole active Work Room surface; and
- desktop and 375px mobile screenshots show no horizontal overflow, clipped
  controls, stale Stop state, duplicate verification UI, duplicate progress
  panels, or fabricated preview.
- initial programmatic focus announces the Work Room task heading without
  drawing a control-like rectangle around that non-interactive heading; every
  interactive button and composer control retains a visible keyboard focus
  indicator.

## Acceptance evidence

Release Beta/RC candidates also run the real installed-artifact gate documented
in `e2e/live/README.md`. `npm run e2e:live` starts the exact `co ai` executable
and production O Chat build, drives a named Co-browser tab through a Rust task,
all three modes, a real Stop, and Host reconnect, then emits one sanitized,
hash-addressed evidence bundle. Reconnect is accepted only when the existing
prompt count is unchanged and the restarted Host log contains no new `INPUT`;
model prose is never treated as lifecycle evidence.

The same gate also builds strict C11 and C++20 projects and delegates a second
C11 project to native Codex. Technical acceptance leaves UI review pending.
Before a Beta/RC release, a reviewer must inspect every hashed desktop, tablet,
and mobile frame and finalize the bundle with `npm run e2e:live:review`; the
finalizer rejects missing frames, vague notes, changed evidence, or unresolved
Critical/High findings.

The maintained E2E scenario asks Codex to create `sort.c` and `test_sort.c`,
compile under `-std=c11 -Wall -Wextra -Werror`, run several fixtures and tests,
then inspect the result. It covers:

- 8 semantic activities, folded earlier activity, raw-data redaction and mobile width;
- a direct Codex message confirmed only after native acceptance, which stays in
  the native conversation and never creates an outer `INPUT` turn;
- a scoped approval whose compact-card and Work Room controls send exactly one
  correlated allow or rejection and settle each other;
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
| 2 | Is there still exactly one compact-card action, except the verified pending-approval strip with its bounded Allow/Reject and detail link? | Card test; shared approval-resolution test |
| 3 | Are raw prompts, commands, paths, IDs, files and provider frames absent from the card? | Redaction assertions and screenshot |
| 4 | Does a preview render only when it is current, bounded and real provider evidence? | Current/stale-artifact unit cases and screenshot |
| 5 | Does Work Room show the current native session and one current status, with at most one different completed result rather than a duplicate live activity — and replace those passive panels with one scoped decision when approval is pending? | Long-run, compact-approval and approval Work Room screenshots |
| 6 | Is earlier activity hidden until the reader explicitly opens it? | Activity-history E2E |
| 7 | Does Stop remain scoped, acknowledge honestly, and fail closed after an ambiguous reload or ACK? | Stop lifecycle E2E |
| 8 | Do completion, failure and unconfirmed states avoid implying success or renewed permission? | Terminal and reconnect E2E |
| 9 | At desktop width, are task, Stop, preview and progress legible without an oversized preview or a clipped control? | Desktop screenshot |
| 10 | At 375px, are the primary action, approval, back navigation and history control reachable with no horizontal overflow? | Mobile screenshot and keyboard assertions |
