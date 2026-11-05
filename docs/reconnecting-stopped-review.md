# Reconnecting and stopped follow-up

Scope: consume connectonion-react PR #115 in the conversation and Work Room.
Keep transport readiness visible while a task or mode change is pending; show a
user-stopped tool as a neutral terminal result. The shared compact indicator uses
the existing green and white presentation.

## Regression evidence

Before app edits, the five focused Vitest files produced **9 failures and 32
passes**. Failures covered failed-first-send transport precedence, reconnecting
and disconnected mode indicators, the missing Work Room indicator, stopped
provider activity, bash/generic terminal copy, and optimistic Stop becoming done.
An additional background-provider regression failed separately because the card
showed `Processing...`. After the fixes, all **42 focused tests pass**. The hook
test also checks the final SDK stopped result after the run returns to idle.

`npm run lint` passes with seven existing warnings. `npx tsc --noEmit` and
`git diff --check` pass. The full unit run has **248 passes and one failure**:
the existing Host ownership test times out starting its local HTTP server. Its
temporary Host log reports `listen EPERM` on 127.0.0.1; an isolated retry also
failed. New tests use browser storage or in-memory data and do not access HOME.

## Independent AI role review

A separate AI reviewer inspected the source and regression evidence from a
technology founder, marketing, and UI perspective. It found the legacy
background-provider stopped fallthrough; that issue was fixed and rechecked.
It found no remaining blocking source issue in the requested changes.

| Priority | Remaining gap and impact | Evidence | Recheck criterion |
| --- | --- | --- | --- |
| P2 | Rendered layout and recovery interaction remain unverified, especially the phone Work Room header. | Next was denied listening on both 0.0.0.0 and 127.0.0.1; browser access host was unavailable. No rendered pages or screenshots were inspected. | Inspect conversation and Work Room at 390, 768 and 1280 px, connected/reconnecting/disconnected, then stopped tools and Reconnect. Check overflow, focus and visible actions. |
| P2 | The real SDK must supply the new statuses. | npm version lookup failed with registry DNS `ENOTFOUND`. Dependency remains `0.4.4-rc.8`; local unions accept stopped. | Pin the published release containing PR #115. Its exact version could not be resolved here. Hold CONNECTED, fail a reconnect, and stop a tool before and after OUTPUT. |
| P2 | Full unit verification is incomplete. | Existing Host startup test fails under denied listen permissions. | Re-run the full unit suite where localhost listeners are permitted. |

Functional component checks pass. Rendered design acceptance and external
reference comparison remain pending; no all-page or live Host pass is claimed.
