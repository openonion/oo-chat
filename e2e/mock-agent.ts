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

/** Where the host says to send an onboard payment. */
export const PAYEE_ADDRESS =
  '0xpay5e11d0c4f1b8d3a6c5e9f2b1a4d7c8e0f3a6b9c2d5e8f1a4b7c0d3e6f9a1b2'

export const AGENT_ADDRESS =
  '0xe2e7e57a9e0c4f1b8d3a6c5e9f2b1a4d7c8e0f3a6b9c2d5e8f1a4b7c0d3e6f9a'

export type Scenario = 'reply' | 'tools' | 'approval' | 'error' | 'offline' | 'dashboard' | 'dashboard-approval' | 'busy' | 'long-reply' | 'onboard-payment' | 'ask-user' | 'ulw-turns'

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

/** Deliberately plain: this is the agent's own page, rendered in a sandboxed
 *  iframe, and the test cares about the pane it lives in rather than its content. */
export const DASHBOARD_HTML =
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<h1 style="font:600 18px system-ui;padding:16px">Deploy board</h1>' +
  '<p style="font:14px system-ui;padding:0 16px">Last ship: 4 minutes ago.</p>'

const send = (ws: WebSocketRoute, frame: Record<string, unknown>) =>
  ws.send(JSON.stringify(frame))

/**
 * Intercept every relay socket and play `scenario`.
 *
 * `routeWebSocket` must be installed before the page navigates, otherwise the SDK
 * opens its socket against the real relay and the test silently becomes a live
 * integration test with none of the guarantees.
 */
export async function mockAgent(
  page: Page,
  scenario: Scenario = 'reply',
  // Fields the test wants to differ from PROFILE — `balance_usd` is the one that
  // matters, since the whole point is what the UI does as the credit runs out.
  overrides: Partial<typeof PROFILE> = {},
) {
  const profile = { ...PROFILE, ...overrides }

  // Every socket except Next's dev-mode hot reload. Which host the SDK dials
  // depends on what the relay record advertises — relay socket for a hosted agent,
  // the agent's own endpoint for a direct one — and the test should not care.
  await page.routeWebSocket(url => !url.pathname.includes('_next'), ws => {
    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw)) as { type: string; prompt?: string }

      if (msg.type === 'CONNECT') {
        // The gate answers CONNECT instead of granting it. Unreachable with the
        // agents in use today — both take invite codes only — which is why this
        // branch drifted far enough to promise a charge it never made.
        if (scenario === 'onboard-payment') {
          send(ws, {
            type: 'ONBOARD_REQUIRED',
            methods: ['invite_code', 'payment'],
            payment_amount: 12,
            payment_address: PAYEE_ADDRESS,
          })
          return
        }
        send(ws, { type: 'CONNECTED', session_id: 'e2e-session', status: 'idle' })
        send(ws, { type: 'AGENT_PROFILE', ...profile })
        // Pushed on connect for agents that ship one. Its arrival is what flips
        // hasDashboard, which is what splits the workspace in two.
        if (scenario === 'dashboard' || scenario === 'dashboard-approval') send(ws, { type: 'DASHBOARD_SNAPSHOT', html: DASHBOARD_HTML })
        return
      }

      if (msg.type !== 'INPUT') return

      if (scenario === 'error') {
        send(ws, { type: 'ERROR', message: 'the agent ran out of credits' })
        return
      }

      // The agent stops and puts a question to the reader. The run parks here —
      // nothing else arrives until they answer — which is the whole point of the
      // card, and why it needs to be reachable and obvious.
      if (scenario === 'ask-user') {
        send(ws, {
          type: 'ask_user',
          id: 'q1',
          text: 'Which environment should I deploy to?',
          options: ['staging', 'production'],
        })
        return
      }

      // A fully autonomous run hitting its turn limit. The agent has been working
      // unattended and is now asking for more rope — the highest-stakes prompt in
      // the app, and the one with no coverage at all.
      if (scenario === 'ulw-turns') {
        send(ws, { type: 'ulw_turns_reached', turns_used: 20, max_turns: 100 })
        return
      }

      send(ws, { type: 'thinking', id: 't1', status: 'running' })

      if (scenario === 'tools' || scenario === 'approval' || scenario === 'dashboard-approval') {
        send(ws, {
          type: 'tool_call',
          id: 'call-1',
          name: 'bash',
          args: { command: 'uname -a', description: 'check the kernel' },
          status: 'running',
        })
      }

      if (scenario === 'dashboard-approval') {
        // Delayed on purpose: the case worth testing is an approval that arrives
        // while the reader is looking at Home, which means the test needs time to
        // switch panes before it lands. An approval that is already on screen when
        // you get there proves nothing about being told.
        setTimeout(() => send(ws, {
          type: 'approval_needed',
          tool: 'bash:uname',
          description: 'Run `uname -a`',
        }), 5000)
        return
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

      // A transcript with several kinds of card in it, which is what the reader
      // actually scrolls through — one card on its own never shows whether the
      // rows share a rhythm or each brings its own.
      if (scenario === 'busy') {
        send(ws, { type: 'tool_call', id: 'c1', name: 'read_file', args: { file_path: 'src/app/page.tsx' }, status: 'running' })
        send(ws, { type: 'tool_result', id: 'c1', name: 'read_file', status: 'done', result: 'export default function Page() {\n  return <main>hello</main>\n}', timing_ms: 210 })
        send(ws, { type: 'tool_call', id: 'c2', name: 'bash', args: { command: 'npm run build', description: 'build the site' }, status: 'running' })
        send(ws, { type: 'tool_result', id: 'c2', name: 'bash', status: 'done', result: '✓ Compiled successfully in 4.2s', timing_ms: 4200 })
        send(ws, { type: 'tool_call', id: 'c3', name: 'grep', args: { pattern: 'useAgentForHuman', path: 'components' }, status: 'running' })
        send(ws, { type: 'tool_result', id: 'c3', name: 'grep', status: 'done', result: 'components/chat/use-agent-sdk.ts:4', timing_ms: 90 })
        send(ws, { type: 'tool_call', id: 'c4', name: 'write_file', args: { file_path: 'src/app/layout.tsx', content: 'export default function Layout() {}' }, status: 'running' })
        send(ws, { type: 'tool_result', id: 'c4', name: 'write_file', status: 'done', result: 'written', timing_ms: 130 })
        send(ws, { type: 'thinking', id: 't1', status: 'done' })
        send(ws, {
          type: 'OUTPUT',
          result: 'Read the page, rebuilt the site, and updated the layout.\n\n```ts\nexport default function Layout({ children }: { children: React.ReactNode }) {\n  return <html><body>{children}</body></html>\n}\n```\n\nThe build finished in 4.2 seconds.',
          session: { session_id: 'e2e-session' },
        })
        return
      }

      // Content that arrives in stages and ends up several viewports tall. The
      // stick-to-bottom logic watches content height rather than item count, so a
      // reply that lands in one frame would never exercise it — it has to grow
      // while the reader is sitting there.
      if (scenario === 'long-reply') {
        for (let i = 1; i <= 24; i++) {
          setTimeout(() => send(ws, {
            type: 'tool_call',
            id: `long-${i}`,
            name: 'read_file',
            args: { file_path: `src/step-${i}.ts` },
            status: 'running',
          }), i * 120)
          setTimeout(() => send(ws, {
            type: 'tool_result',
            id: `long-${i}`,
            name: 'read_file',
            status: 'done',
            result: Array.from({ length: 6 }, (_, n) => `step ${i} line ${n + 1}`).join('\n'),
            timing_ms: 40,
          }), i * 120 + 40)
        }
        setTimeout(() => send(ws, {
          type: 'OUTPUT',
          result: 'Walked every step. The last line is the one that matters.',
          session: { session_id: 'e2e-session' },
        }), 3400)
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
        profile,
      }),
    })
  )

  await page.route(/\/info(\?|$)/, route =>
    route.fulfill({
      status: scenario === 'offline' ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(profile),
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
