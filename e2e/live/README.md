# Live production release acceptance

This is the Beta/RC release gate for a real installed `co ai` candidate, the
exact O Chat production build, and the persistent Co-browser. It does not use
the mocked Playwright agent or `next dev`.

## What the outer runner owns

`npm run e2e:live` invokes `run-release-candidate.sh`, which:

1. builds and starts this exact O Chat commit with `next start`;
2. starts an owned deterministic browser search/download fixture;
3. starts the selected `co` executable in a dedicated workspace;
4. discovers the candidate Agent address from a private Host log;
5. runs the named-tab browser journey;
6. restarts only its own Host process for reconnect acceptance;
7. stops only its own Host/frontend/fixture processes;
8. writes sanitized logs, screenshots, and `manifest.json` into one evidence
   directory.

Raw logs stay in a mode-700 temporary directory printed at the end. They are
never copied into release evidence. The sanitized copies remove ANSI control
sequences, exact configured secret values, the workspace/home path, private
macOS/Linux/Windows paths, authorization/cookie fields, bearer values, and
Agent addresses. If a known invite or token could appear in output, put its
exact value in a mode-600 file and pass that file through
`LIVE_E2E_SECRET_VALUES_FILE`. Never pass a secret on the command line.

For a fresh browser identity, put the one-run Host invite in its own mode-600
file and set `LIVE_E2E_INVITE_CODE_FILE`. The outer runner passes only that file
path to `co ai --invite-code-file`; the browser runner streams the value through
stdin into Co-browser's controlled-input fill command, validates only the
resulting character count, and takes no screenshot while the value is present.
The sanitizer automatically treats this file as a source of forbidden values.
When this variable is set, the outer runner also defaults to an isolated browser
socket and profile inside the private run directory while retaining the real
HOME needed by native provider authentication. It closes only that owned daemon
at cleanup; the user's persistent browser daemon/profile is never modified or
stopped. This guarantees the gate exercises first-run onboarding instead of
silently reusing an identity that was already a contact.

## Preconditions

1. Install the exact public or candidate Core artifact into a fresh virtual
   environment. Point `LIVE_E2E_CO_BIN` at that environment's `co` executable.
2. Check out the exact O Chat candidate in a clean worktree. The runner refuses
   modified or untracked source so the manifest commit identifies what ran.
3. Prepare a dedicated Host workspace. It must contain no application files;
   an existing `.co/` authorization directory is allowed.
4. For first-run onboarding, create a non-empty mode-600 invite code file. The
   exact Core candidate must support `co ai --invite-code-file`.
5. Check `co browser tab ls`. The runner uses only its named tab and never
   closes the shared browser daemon.
6. Install and authenticate the native `codex` and `claude` CLIs. The gate
   requires real handoffs to both providers, then sends a provider-targeted
   Claude Code follow-up through the opened Work Room. In the Codex Work Room it
   also records the four native permission profiles, changes Read Only →
   separately confirmed Full Access, lowers the outer ceiling to Auto, proves
   stale provider Full Access is revoked and disabled, then acknowledges Ask
   for approval. It fails closed if provider, conversation, catalog,
   acknowledgement, ceiling, or outer-mode evidence is missing.
7. Install C11 and C++20 compilers plus Cargo; every generated project is rebuilt
   by the harness rather than trusted from the model's report.

The browser task remains bounded at four minutes so a cold isolated daemon can
complete every required RPC and still emit the parent turn's terminal event.

## Run the complete gate

```bash
chmod 600 /absolute/private/release-secret-values.txt
chmod 600 /absolute/private/release-invite.txt

LIVE_E2E_CO_BIN=/absolute/candidate-venv/bin/co \
LIVE_E2E_WORKSPACE=/absolute/dedicated-host-workspace \
LIVE_E2E_INVITE_CODE_FILE=/absolute/private/release-invite.txt \
LIVE_E2E_SECRET_VALUES_FILE=/absolute/private/release-secret-values.txt \
npm run e2e:live
```

Technical acceptance intentionally leaves `checks.uiReviewPassed` false. A UI
reviewer must inspect every hashed PNG, record concrete notes, and finalize the
same evidence bundle before it can support a Beta/RC release:

```bash
npm run e2e:live:review -- \
  /absolute/evidence-directory \
  /absolute/ui-review.json
```

The review JSON uses schema version 1, names every screenshot from the manifest
exactly once, uses a `reviewedAt` timestamp after evidence generation, and
records a `pass` plus a concrete note for each of:
`newUserExperience`, `clientFamiliarity`, `composerAndConversation`,
`thinkingAndWorking`, `toolActivity`, and `responsiveLayout`. Its `issues` array
may retain resolved findings or open medium/low polish; unresolved Critical or
High findings fail closed. The finalizer first verifies every existing evidence
hash, then writes `ui-review.json`, adds its hash, and sets
`checks.uiReviewPassed` true.

Minimal review shape (replace the screenshot list with every `.png` path from
`manifest.json`; notes must describe what the reviewer actually saw):

```json
{
  "schemaVersion": 1,
  "reviewer": "UI designer name",
  "reviewedAt": "REPLACE_WITH_REVIEW_TIME_AFTER_EVIDENCE_GENERATION",
  "screenshotsReviewed": ["screenshots/live-production-example.png"],
  "checks": {
    "newUserExperience": { "status": "pass", "notes": "The first action and current state are immediately understandable." },
    "clientFamiliarity": { "status": "pass", "notes": "The conversation, composer, and activity read like a coding client." },
    "composerAndConversation": { "status": "pass", "notes": "User and assistant messages remain visible above the fixed composer." },
    "thinkingAndWorking": { "status": "pass", "notes": "Thinking and active work are distinguishable without raw implementation noise." },
    "toolActivity": { "status": "pass", "notes": "Browser and compiler activity use concise semantic summaries." },
    "responsiveLayout": { "status": "pass", "notes": "Desktop, tablet, and phone controls remain reachable without overflow." }
  },
  "issues": []
}
```

Optional variables:

- `LIVE_E2E_HOST_PORT` (default `8765`)
- `LIVE_E2E_FRONTEND_PORT` (default `3100`)
- `LIVE_E2E_BROWSER_FIXTURE_PORT` (default `3191`)
- `LIVE_E2E_BASE_URL` to override the browser-visible localhost/LAN origin
- `LIVE_E2E_PUBLIC_FRONTEND_URL` to record the exact deployed preview when the
  browser-visible origin is not the local production server
- `LIVE_E2E_INVITE_CODE_FILE` for automated first-run onboarding
- `LIVE_E2E_BROWSER_PROFILE_DIR` / `LIVE_E2E_BROWSER_SOCK` to override the
  default isolated browser identity without replacing the real `HOME`
- `LIVE_E2E_BROWSER_HEADLESS=false` to show the isolated browser window instead
  of the default deterministic headless release run
- `LIVE_E2E_BROWSER_SHARED=true` to use only an owned named tab in the existing
  persistent browser when a fresh deployment origin provides the clean identity;
  cleanup never closes the shared daemon
- `LIVE_E2E_TAB` / `LIVE_E2E_WHO`
- `LIVE_E2E_PRIVATE_DIR` for raw logs
- `LIVE_E2E_EVIDENCE_DIR` for the sanitized evidence bundle
- `LIVE_E2E_RUN_ID` for a stable bundle name

## Acceptance performed

The browser journey:

- selects bounded Full access through the real confirmation UI;
- asks the real Agent to search a deterministic local release catalog through
  `co browser`, render the result, and click a real attachment download using
  the gate's isolated daemon; the fixture log and report independently prove
  both requests, and the completed browser Tool Cards are screenshot;
- asks the real Agent to create a strict C11 insertion-sort library and tests,
  then independently recompiles both binaries with `-Wall -Wextra -Werror` and
  verifies exact fixture output;
- asks the real Agent to create a C++20 LRU-cache project, then independently
  compiles its tests and program with strict warnings and verifies exact output;
- asks the real Agent to create a non-trivial Rust CLI, unit test, and README;
- independently runs `cargo test` and verifies the exact JSON program output;
- requires the outer Agent to delegate a second C11 project to native Codex,
  independently recompiles its ring-buffer tests, and inspects the completed
  Codex Workroom for attributed conversation, current status, and composer;
- requires both completed provider Work Rooms to expose enabled provider-named
  voice controls; for Codex it injects a deterministic browser microphone
  denial, preserves the provider-only draft, proves no outer or provider input
  reached Host without explicit Send, and captures desktop/mobile recovery;
- starts bounded 90-second native Codex and Claude Code follow-ups, stops each
  from its Work Room, verifies the Host receives `PROVIDER_INTERRUPT` rather
  than outer `INTERRUPT`, waits for an honest Stopped state, and proves each
  completion marker was never emitted;
- verifies the real Codex permission catalog contains Read Only, Ask for
  approval, Approve for me, and Full Access; changes Read Only → Full Access
  through a separate risk confirmation; lowers outer COAI authority to Auto;
  requires the provider state to drop stale Full Access and disable it; then
  acknowledges Ask for approval, requires all three browser-originated Host
  transactions, and captures allowed/denied states at desktop and mobile widths;
- requires a real Claude Code C11 handoff, independently recompiles its bounded
  stack tests, then sends and verifies a provider-targeted follow-up in the same
  Work Room session;
- proves the Agent wrote nothing outside the requested project;
- changes Full access → Read only → Auto and verifies each acknowledgement;
- starts a deliberately long turn, waits for the real running lifecycle, clicks
  **Stop agent exactly once**, and waits for the Send control to return;
- stops the owned Host, verifies the disconnected UI offers **Reconnect** and
  not **Retry**, restarts the same Host, settles either one explicit Reconnect
  click or the product's authoritative automatic reconnect, and verifies
  neither the prompt count nor Host `INPUT` count increases;
- checks 1440×900, 768×1024, and 390×844 viewport width/no-overflow state;
- saves browser/C/Rust running states, the completed Codex and Claude Code Work
  Rooms, Codex voice recovery and permission menus, Stop, disconnected,
  reconnected, desktop, tablet, and phone screenshots.

Success never depends on model prose. Browser lifecycle controls, filesystem
checks, exact command output, Host log deltas, and layout probes are the
authoritative evidence.

`manifest.json` records exact Core/React/O Chat identifiers, every asserted
gate, and SHA-256/byte length for each sanitized log and screenshot. A release
claim requires `uiReviewPassed: true`; merely producing screenshots is not UI
review evidence.

## Browser-only debugging

When the exact Host and production frontend are already running, use the inner
runner directly:

```bash
LIVE_E2E_ADDRESS=0x... \
LIVE_E2E_WORKSPACE=/absolute/dedicated-host-workspace \
LIVE_E2E_HOST_CONTROL=/absolute/owned-host-control-script \
LIVE_E2E_HOST_LOG=/absolute/private/host.raw.log \
LIVE_E2E_BROWSER_FIXTURE_URL=http://127.0.0.1:3191 \
LIVE_E2E_BROWSER_FIXTURE_LOG=/absolute/private/browser-fixture.raw.log \
npm run e2e:live:browser-only
```

The fixture must already be running for this debugging-only form. A release
claim uses the outer runner so
process ownership, exact versions, sanitized logs, and the manifest are all
captured together.
