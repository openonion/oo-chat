# Live production release acceptance

This is the Beta/RC release gate for a real installed `co ai` candidate, the
exact O Chat production build, and the persistent Co-browser. It does not use
the mocked Playwright agent or `next dev`.

## What the outer runner owns

`npm run e2e:live` invokes `run-release-candidate.sh`, which:

1. builds and starts this exact O Chat commit with `next start`;
2. starts the selected `co` executable in a dedicated workspace;
3. discovers the candidate Agent address from a private Host log;
4. runs the named-tab browser journey;
5. restarts only its own Host process for reconnect acceptance;
6. stops only its own Host/frontend processes;
7. writes sanitized logs, screenshots, and `manifest.json` into one evidence
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
6. Install and authenticate the native `codex` CLI. The gate requires a real
   provider handoff and fails closed if it receives no Codex Workroom evidence.
7. Install a C11 compiler and Cargo; both generated projects are rebuilt by the
   harness rather than trusted from the model's report.

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

Optional variables:

- `LIVE_E2E_HOST_PORT` (default `8765`)
- `LIVE_E2E_FRONTEND_PORT` (default `3100`)
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
- asks the real Agent to inspect a deterministic local page through `co browser`
  using the gate's isolated daemon, then independently verifies its report;
- asks the real Agent to create a strict C11 insertion-sort library and tests,
  then independently recompiles both binaries with `-Wall -Wextra -Werror` and
  verifies exact fixture output;
- asks the real Agent to create a non-trivial Rust CLI, unit test, and README;
- independently runs `cargo test` and verifies the exact JSON program output;
- requires the outer Agent to delegate a second C11 project to native Codex,
  independently recompiles its ring-buffer tests, and inspects the completed
  Codex Workroom for attributed conversation, current status, and composer;
- proves the Agent wrote nothing outside the requested project;
- changes Full access → Read only → Auto and verifies each acknowledgement;
- starts a deliberately long turn, waits for the real running lifecycle, clicks
  **Stop agent exactly once**, and waits for the Send control to return;
- stops the owned Host, verifies the disconnected UI offers **Reconnect** and
  not **Retry**, restarts the same Host, settles either one explicit Reconnect
  click or the product's authoritative automatic reconnect, and verifies
  neither the prompt count nor Host `INPUT` count increases;
- checks 1440×900, 768×1024, and 390×844 viewport width/no-overflow state;
- saves browser/C/Rust running states, the completed Codex Workroom, Stop,
  disconnected, reconnected, desktop, tablet, and phone screenshots.

Success never depends on model prose. Browser lifecycle controls, filesystem
checks, exact command output, Host log deltas, and layout probes are the
authoritative evidence.

`manifest.json` records exact Core/React/O Chat identifiers, every asserted
gate, and SHA-256/byte length for each sanitized log and screenshot. Inspect
every screenshot before attaching the bundle to the release Issue.

## Browser-only debugging

When the exact Host and production frontend are already running, use the inner
runner directly:

```bash
LIVE_E2E_ADDRESS=0x... \
LIVE_E2E_WORKSPACE=/absolute/dedicated-host-workspace \
LIVE_E2E_HOST_CONTROL=/absolute/owned-host-control-script \
LIVE_E2E_HOST_LOG=/absolute/private/host.raw.log \
npm run e2e:live:browser-only
```

This form is for debugging only. A release claim uses the outer runner so
process ownership, exact versions, sanitized logs, and the manifest are all
captured together.
