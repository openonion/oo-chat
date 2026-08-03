/**
 * A scripted agent that speaks the real relay protocol, served inside the browser.
 *
 * Why not point the tests at a live agent: a hosted agent going down would turn
 * every pull request red for a reason that has nothing to do with the change, and
 * the states worth screenshotting — an approval prompt, a blocked run, an error —
 * are exactly the ones a healthy agent rarely produces on demand.
 *
 * The frames below are the ones `connectonion`'s RemoteAgent actually handles
 * (see connectonion-ts src/connect/remote-agent.ts): CONNECT/INPUT inbound,
 * CONNECTED, AGENT_PROFILE, the streamed chat-item events, and OUTPUT/ERROR. The
 * SDK still opens a real WebSocket and runs its real parser — only the far end is
 * ours — so a protocol change breaks these tests, which is the point.
 */

import type { Page, WebSocketRoute } from '@playwright/test'

export const AGENT_ADDRESS =
  '0xe2e7e57a9e0c4f1b8d3a6c5e9f2b1a4d7c8e0f3a6b9c2d5e8f1a4b7c0d3e6f9a'

export type Scenario = 'reply' | 'tools' | 'approval' | 'error' | 'offline'

/** What /info and the AGENT_PROFILE frame agree on. Also what the landing page renders. */
export const PROFILE = {
  address: AGENT_ADDRESS,
  name: 'Scriptbot',
  model: 'co/gemini-2.5-pro',
  trust: 'careful',
  version: '1.5.10',
  online: true,
  balance_usd: 4.2,
  tools: ['bash', 'read_file', 'write_file', 'browser', 'send_email', 'search'],
  skills: [
    { name: 'deploy', description: 'Ship the current branch to production' },
    { name: 'summarise', description: 'Summarise a document you paste in' },
  ],
}

const send = (ws: WebSocketRoute, frame: Record<string, unknown>) =>
  ws.send(JSON.stringify(frame))

/**
 * Intercept every relay socket and play `scenario`.
 *
 * `routeWebSocket` must be installed before the page navigates, otherwise the SDK
 * opens its socket against the real relay and the test silently becomes a live
 * integration test with none of the guarantees.
 */
export async function mockAgent(page: Page, scenario: Scenario = 'reply') {
  // Every socket except Next's dev-mode hot reload. Which host the SDK dials
  // depends on what the relay record advertises — relay socket for a hosted agent,
  // the agent's own endpoint for a direct one — and the test should not care.
  await page.routeWebSocket(url => !url.pathname.includes('_next'), ws => {
    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw)) as { type: string; prompt?: string }

      if (msg.type === 'CONNECT') {
        send(ws, { type: 'CONNECTED', session_id: 'e2e-session', status: 'idle' })
        send(ws, { type: 'AGENT_PROFILE', ...PROFILE })
        return
      }

      if (msg.type !== 'INPUT') return

      if (scenario === 'error') {
        send(ws, { type: 'ERROR', message: 'the agent ran out of credits' })
        return
      }

      send(ws, { type: 'thinking', id: 't1', status: 'running' })

      if (scenario === 'tools' || scenario === 'approval') {
        send(ws, {
          type: 'tool_call',
          id: 'call-1',
          name: 'bash',
          args: { command: 'uname -a', description: 'check the kernel' },
          status: 'running',
        })
      }

      if (scenario === 'approval') {
        // The run parks here: no OUTPUT until the reader answers. That is the state
        // the approval card exists for, and the one worth a screenshot.
        send(ws, {
          type: 'approval_needed',
          tool: 'bash:uname',
          description: 'Run `uname -a`',
        })
        return
      }

      if (scenario === 'tools') {
        send(ws, {
          type: 'tool_result',
          id: 'call-1',
          name: 'bash',
          status: 'done',
          result: 'Darwin 23.1.0 arm64',
          timing_ms: 1240,
        })
      }

      send(ws, { type: 'thinking', id: 't1', status: 'done' })
      send(ws, {
        type: 'OUTPUT',
        result:
          scenario === 'tools'
            ? 'The machine reports `Darwin 23.1.0 arm64`.'
            : `You said: ${msg.prompt}`,
        session: { session_id: 'e2e-session' },
      })
    })
  })

  // Before any socket exists the app resolves the agent over HTTP — the relay
  // directory first, then a direct /info probe. Both have to answer, or the page
  // renders the offline state and every screenshot is a picture of that instead
  // of the product.
  // The relay wraps the profile — {endpoints, relay, last_seen, profile} — while a
  // direct /info probe returns the profile flat. Returning the flat shape from both
  // is what made the sidebar show "ALL AGENTS OFFLINE" next to a landing page saying
  // online: the socket had a profile, the HTTP path could not read one.
  await page.route(/oo\.openonion\.ai\/api\/agents\//, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        endpoints: scenario === 'offline' ? [] : ['https://scriptbot.example'],
        relay: 'wss://oo.openonion.ai/ws',
        last_seen: new Date(0).toISOString(),
        profile: PROFILE,
      }),
    })
  )

  await page.route(/\/info(\?|$)/, route =>
    route.fulfill({
      status: scenario === 'offline' ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(PROFILE),
    })
  )

  // Auth is a real round trip to the backend on a preview deploy. Answering it
  // here keeps the run hermetic and stops a backend hiccup failing a UI test.
  await page.route(/\/api\/auth$/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-token', public_key: '0xe2e' }),
    })
  )
}
