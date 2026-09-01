# Full Web Control Center

O Chat supports two intentionally different Agent surfaces:

- Legacy `.co/dashboard.html` is an inert snapshot. O Chat wraps it in a restrictive
  sandbox and only its declarative `data-ochat-skill` buttons can create turns.
- A Control Center app is a reviewed, immutable HTTPS Web app. It runs as a normal
  cross-origin document in an iframe and can use JavaScript, modules, frameworks,
  storage, Workers, Canvas, WebGL, WASM, and ordinary browser networking.

Legacy HTML cannot promote itself into the second mode. After authentication, Host
sends a separate `CONTROL_CENTER_APP` frame and `@connectonion/react` exposes its
descriptor. O Chat mounts only a supported HTTPS revision whose review status is
`approved`; reviewing and blocked revisions leave Chat available without executing
the candidate.

```json
{
  "type": "CONTROL_CENTER_APP",
  "session_id": "session-id",
  "app": {
    "schema": "connectonion.control-app/1",
    "revision": "sha256:...",
    "url": "https://apps.openonion.ai/agent/revision/index.html",
    "sdk_version": "1",
    "review": { "status": "approved", "review_id": "..." },
    "capabilities": ["clipboard-write", "fullscreen"]
  }
}
```

## Runtime boundary

The full app iframe deliberately has no feature-limiting `sandbox`. Its hard browser
boundary is a separate HTTPS origin. O Chat also rejects URL credentials, same-origin
apps, malformed content hashes, unsupported SDK versions, unknown review states, and
undeclared permission features. The descriptor's capability list becomes the iframe
`allow` policy; it never grants Agent identity keys or ambient O Chat credentials.

O Chat and the app perform one origin-, protocol-, and revision-checked window
handshake. The parent transfers one `MessagePort`; all context, requests, and replies
then use that private channel. Reloading or changing revision closes the old port.
The iframe does not open a second Agent WebSocket: the parent remains the only owner
of `useAgentForHuman`, reconnect, trust, approval, transcript, and session state.
The initial context also carries the authenticated Agent address and name, current
conversation, and published skill list. A default template can therefore show the
real identity and complete address in Diagnostics, then build real buttons without
hard-coding one Agent's capabilities.

## Buttons and conversations

A button is product UI, but an Agent action must still be a visible, attributable
conversation turn. The bridge currently exposes two actions:

```ts
port.postMessage({
  type: 'connectonion.control-center/request',
  version: 1,
  revision,
  id: crypto.randomUUID(),
  action: 'run_skill',
  payload: { skill: 'generate-invoice', args: 'invoice 1042' },
})

port.postMessage({
  type: 'connectonion.control-center/request',
  version: 1,
  revision,
  id: crypto.randomUUID(),
  action: 'send_message',
  payload: { message: 'Explain the GST calculation.' },
})
```

Both default to the current Agent and current conversation. On an Agent landing page,
where no conversation exists yet, the first action creates one and becomes its first
visible user turn. A product must explicitly send `conversation: 'new'` to open a
separate chat. This is reserved for workflows that truly need clean context; routine
invoice buttons, follow-ups, and refinements stay together.

`run_skill` is accepted only when the Agent's authenticated profile publishes the
named skill. The parent bounds message, skill-name, argument, and request-ID sizes,
deduplicates action IDs per revision, and returns a correlated success or error with
the resulting session ID. Normal Host trust, approval, mode, and tool policies still
decide what the resulting turn may do.

The app should show the correlated acknowledgement immediately. Agent output and
ordered normalized conversation events are the next bridge layer; Chat remains the
authoritative output surface until those event subscriptions land.

## Verification

Run the focused unit and browser coverage:

```bash
npm test -- --run components/dashboard/control-center-app.test.ts \
  components/dashboard/control-center-app-pane.test.tsx

E2E_BASE_URL=http://localhost:3018 \
  npx playwright test e2e/control-center-app.spec.ts --project=chromium --workers=1
```

The E2E fixture is a complete cross-origin invoice page. It verifies current-chat
continuity, an explicit new-chat action, visible `/generate-invoice` attribution, and
a usable 375px mobile layout.
