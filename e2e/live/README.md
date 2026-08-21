# Live production release acceptance

This gate exercises a real `co ai` Host through the persistent Co-browser. It
deliberately does not use the mocked Playwright agent or `next dev`.

## Preconditions

1. Create a dedicated empty workspace and a mode-600 invite file outside every
   repository. Never put the invite in logs or screenshots.
2. Start the exact Core candidate from that workspace with bounded Full access,
   for example `co ai --port 8765 --full-access --full-access-turns 12`.
3. Build and start the exact O Chat candidate with `npm run build` followed by
   `npm start -- -p 3100`. Do not use `next dev`: React development replay can
   create misleading session handoff results.
4. Trust the persistent Co-browser identity once with the one-time invite. Close
   only the named release tab; never close the shared browser daemon.

## Run

Set the public Host address and the same dedicated Host workspace, then run:

```bash
LIVE_E2E_ADDRESS=0x... \
LIVE_E2E_WORKSPACE=/absolute/path/to/empty-host-workspace \
bash e2e/live/run-production-acceptance.sh
```

The gate creates and tests a Rust CLI through the real agent, checks its exact
JSON output, proves the workspace boundary, exercises Full access, Read only,
and Auto, and saves desktop/mobile evidence under `e2e-screenshots/`.
It observes the production run lifecycle through the Stop control and the
composer's restored Send control; completion never depends on the model
repeating a particular phrase.

Host and frontend logs should be captured by the outer release runner. Sanitize
them before attaching release evidence, and verify that the invite value is not
present. Stop both candidate processes after the run.
