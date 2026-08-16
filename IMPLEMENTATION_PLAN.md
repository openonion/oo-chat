# Work Room: simple, safe, observable

## Decision gate

This plan follows the first independent UI and interaction audits recorded in
oo-chat#187 and the OIP contract follow-up in connectonion#1109. No release is
ready until every required gate below has evidence from a real native Codex C
sorting run. This is OIP-only: it must not restore ACP UI or add a generic third
coding adapter.

## Product contract

The product has four separate information layers. A reader should never have to
parse source code or provider transport to understand the default screen.

1. **Conversation summary** — who is working, current natural-language action,
   current state or concise result, and one entry action.
2. **Decision** — approval meaning, verified boundary, reason, and a deliberate
   action. This lives in the Work Room, not in the transcript.
3. **Evidence** — semantic activity, checks, files, and a genuine provider
   artifact if one exists.
4. **Technical detail** — bounded, redacted per-step detail behind explicit
   disclosure. It is never the default view.

## UI design to implement

### Parent conversation card

- Normal height is approximately 96px; approval state may grow to approximately
  124px, never into a terminal transcript.
- It shows a safe task title, one current semantic action, state/result, and one
  action: **Open Work Room** or **Review decision**.
- It contains no raw command, cwd, session identifier, JSON, local path, tool
  result, or fabricated terminal/screenshot treatment.
- If there is no real provider artifact, use the literal label **Real-time
  activity**, not "thumbnail", "screen", or a terminal-like panel.
- Completion includes a concise verified outcome; failure includes the last safe
  checkpoint and next action.

### Work Room

- The default is **Overview**: safe task title, progress/check summary, current
  activity, at most three recent semantic steps, and a short file list only
  when Core supplied genuine file evidence.
- **Activity** is the one secondary section. Files belong inline in Overview;
  Messages and technical disclosure are not rendered until they have a real
  typed OIP contract. This keeps the default to two clear levels rather than
  three competing page tabs.
- There is one vertical scrolling surface. "Show earlier steps" expands inside
  that surface; it must not create a second hidden scroll region.
- The dialog opens with focus in the current decision or heading, traps focus,
  makes the background inert, restores focus to its opener, announces new
  blocking decisions, and supports Escape.
- The Work Room is the only place that can show technical detail or approval
  controls. Stop identifies the target provider session and moves to a disabled
  stopping state after one click.

## Current delivery checklist

- [x] OIP-only native Codex and Claude Code envelope; no ACP fallback is added.
- [x] Core emits a finite, redacted task/activity/approval vocabulary and
  React rejects arbitrary provider text rather than rendering transport data.
- [x] Unknown and elevated approval boundaries fail closed.
- [x] A targeted Stop sends `PROVIDER_INTERRUPT` for the exact invocation and
  does not send a global turn interrupt.
- [x] Simplified information hierarchy: compact card; Overview + Activity;
  real file evidence inline only; no fabricated thumbnail.
- [x] Core unit gate, React contract gate, O Chat type gate, and O Chat unit
  gate pass for the current slice.
- [x] Complete browser acceptance for the long C-sorting mock, targeted Stop,
  approval, desktop, 375px, and 320px views; inspect the captured screenshots.
  All nine Chromium scenarios passed after the final mobile and stopped-state
  changes.
- [x] Run the same C-sorting task through a real native Codex invocation in an
  isolated workspace, then record only its safe OIP evidence. The localhost
  Host run exercised two one-time approvals, completed a strict C11 rebuild
  and test run, and a separate run proved exact provider Stop reaches a
  `cancelled` terminal state without cancelling the outer turn.
- [ ] Define and implement a real `provider_continuation` protocol before any
  continuation composer is exposed. Do not ship a fake chat input.
- [ ] Update preview package/repository pins, release notes, deployment skill,
  PRs/issues, and alpha release only after all acceptance gates are green.

### Approval presentation

- First show **what will happen**, **where it applies**, and **why** in
  non-technical language. Core—not the browser—provides verified scope.
- **Allow once** and **Reject this request** are the two equally reachable
  decision actions. This is not a global Stop: it resolves the current native
  permission request only.
- **Trust for this session** and **Reject and ask for an explanation** live
  under Other review options. **Stop** appears only for a starting/running
  provider invocation, targets its exact invocation ID, and never appears
  while an approval is waiting.
- A scope outside the declared Work Room is elevated and cannot receive an
  ordinary allow action.
- Technical arguments are redacted and disclosed only on demand.

## OIP / React contract required before the final UI claims

Core translates Codex and Claude Code native events into typed, provider-neutral
events. React normalizes ordering, replay, compatibility, and action
correlation. O Chat renders that type only.

Required additive forms:

- `provider_invocation`: stable IDs, safe `taskTitle`, `currentSummary`,
  permission mode, terminal `resultSummary` or safe error.
- `provider_activity`: stable sequence and invocation correlation; semantic
  kind/state/title/summary; safe relative files/checks; bounded technical detail.
- `approval_needed` with `providerApproval`: native request correlation; human
  summary; Core-verified scope classification; authoritative resolution
  options. The browser must fail closed if that presentation is absent.
- `provider_artifact`: optional real renderable evidence, source, alt text,
  timestamp, and activity correlation. No artifact means no preview image.
- `provider_continuation`: invocation/session/client-message correlation and
  explicit Sending, Queued, Delivered, Running, Completed, or Failed lifecycle.

Old Hosts retain the generic correlated-tool fallback. That fallback is labelled
legacy activity and cannot be presented as verified files, checks, or visuals.
The current remote `@connectonion/react` OIP reader already removed ACP from
its active path; implementation starts from that current reader and must never
restore ACP as a second path. The older local checkout is not a valid source.

## Implementation order

1. **Contract first** — write Core and React fixtures for the envelope, ordering,
   scope validation, artifact absence, and old-host fallback. Publish a React
   preview reader before Core writes new fields.
2. **Safe interactions** — implement approval information architecture, dialog
   focus/keyboard behavior, and targeted Stop against those fixtures.
3. **Presentation** — implement the parent summary and Work Room Overview,
   then one secondary Activity view. Inline files appear only with typed evidence.
4. **Evidence** — add an actual native Codex C sorting run and the equivalent
   Claude Code run. Do not use an injected screenshot or a toy one-shot prompt.
5. **Release** — require green unit/type/lint/browser gates, GitHub preview,
   production Vercel deployment, public package verification where package code
   changed, and a final browser replay.

## Required real C acceptance flow

Use a fresh, dedicated workspace only. Native Codex must inspect it, describe a
plan, create `sort.c` and `test_sort.c`, inspect both, compile with strict C11
warnings, run at least three sort inputs, run the test binary, inspect final
sources/output, and report checks. The run must create at least eight observable
transitions. A continuation is a separate acceptance item only once the typed
continuation protocol exists.

Capture and inspect desktop and 375px screenshots for: running parent card,
approval, Work Room overview, Activity, completion, failure handling, and
targeted Stop. Verify no horizontal overflow, no double scroll, no raw data in
the parent card, 44px-or-larger critical touch targets, and a single clear next
action. Also test a 320px approval viewport.

## Review gate for every implementation round

Before starting a new implementation slice and after taking its screenshots:

1. a UI review ranks visual hierarchy, density, truthfulness of evidence,
   desktop/mobile composition, and accessibility; and
2. an interaction review ranks the ten largest remaining user/safety risks,
   including approval, continuation, result accuracy, Stop, focus, and mobile.

Any P0 finding blocks release. The next implementation slice starts only after
the findings, exact acceptance checks, and responsible layer are recorded.
