/**
 * A scripted agent that speaks the real relay protocol, served inside the browser.
 *
 * Why not point the tests at a live agent: a hosted agent going down would turn
 * every pull request red for a reason that has nothing to do with the change, and
 * the states worth screenshotting — an approval prompt, a blocked run, an error —
 * are exactly the ones a healthy agent rarely produces on demand.
 *
 * The frames below are the ones `@connectonion/react`'s RemoteAgent actually handles
 * (see connectonion-react src/connect/remote-agent.ts): CONNECT/INPUT inbound,
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

export type Scenario = 'reply' | 'tools' | 'coding-agent' | 'coding-agent-completed' | 'coding-agent-failed' | 'coding-agent-long-approval' | 'coding-agent-stale-approval' | 'coding-agent-stop-ack-no-terminal' | 'coding-agent-stop-delayed-ack' | 'coding-agent-stop-fresh-state' | 'coding-agent-stop-rejected' | 'approval' | 'error' | 'error-once' | 'offline' | 'dashboard' | 'dashboard-approval' | 'busy' | 'long-reply' | 'drop' | 'gate-midway' | 'balance-drains' | 'dashboard-drains' | 'dashboard-error' | 'dashboard-drop' | 'onboard-payment' | 'pr-evidence' | 'ask-user' | 'full-access-checkpoint' | 'plan' | 'mode-delay' | 'mode-reject' | 'mode-disconnect' | 'cancel'

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

export const UPDATED_DASHBOARD_HTML =
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<main style="font:14px system-ui;padding:16px">' +
  '<h1 style="font-size:18px">Release Control Center</h1>' +
  '<p role="status">Release 1.6.11 verified</p>' +
  '<p>Invite accepted · prompt completed · execution modes acknowledged</p>' +
  '</main>'

const send = (ws: WebSocketRoute, frame: Record<string, unknown>) =>
  ws.send(JSON.stringify(frame))

const approvalEvent = {
  id: 'approval-event-1',
  tool_call_id: 'call-1',
  tool: 'bash:uname',
  arguments: { command: 'uname -a' },
  description: 'Run `uname -a`',
}

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
  /** Per-call, so the drop scenario interrupts one connection rather than all of them. */
  let dropped = false
  /** How many times a client has handshaked. The only way to see a socket torn
   *  down and reopened behind the reader — the screen looks identical either way,
   *  which is what makes a screen-level assertion about it vacuous. */
  let connects = 0
  let activeSessionId = 'e2e-session'
  let planInputs = 0
  let terminalErrorInputs = 0
  let codingAgentInputs = 0
  /** Authoritative policy changes only after the mock Host acknowledges OIP. */
  let currentMode = ':read-only'
  let pendingModeAcknowledgement: (() => void) | null = null
  let fullAccessCheckpointSent = false
  let onboarded = false
  /** Every frame the client sent. The approval buttons differ only in the frame
   *  they produce — the UI is identical whichever one is wired to which — so the
   *  wire is the only place that difference is observable. */
  const sent: Record<string, unknown>[] = []

  // Every socket except Next's dev-mode hot reload. Which host the SDK dials
  // depends on what the relay record advertises — relay socket for a hosted agent,
  // the agent's own endpoint for a direct one — and the test should not care.
  await page.routeWebSocket(url => !url.pathname.includes('_next'), ws => {
    let connectedSessionId = activeSessionId
    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw)) as {
        type: string
        prompt?: string
        session_id?: string
        mode?: string
        invocationId?: string
        requestId?: string
        stateRevision?: number
      }
      sent.push(msg)

      // An offline agent answers nothing. Replying to CONNECT with a profile is
      // proof of life, and the app is right to treat it as such — which is why
      // this scenario still reported "online" after its endpoints and relay were
      // taken away. Offline has to mean silence.
      if (scenario === 'offline') return

      if (msg.type === 'CONNECT') {
        connectedSessionId = msg.session_id || connectedSessionId
        activeSessionId = connectedSessionId
        // The gate answers CONNECT instead of granting it. Unreachable with the
        // agents in use today — both take invite codes only — which is why this
        // branch drifted far enough to promise a charge it never made.
        if (scenario === 'onboard-payment' || (scenario === 'pr-evidence' && !onboarded)) {
          send(ws, {
            type: 'ONBOARD_REQUIRED',
            methods: ['invite_code', 'payment'],
            payment_amount: 12,
            payment_address: PAYEE_ADDRESS,
          })
          return
        }
        connects += 1
        // A real WebSocket delivers the Host reply in a later event-loop turn.
        // Preserve that boundary: Playwright's in-page route can otherwise answer
        // synchronously inside send(CONNECT), before the SDK installs its waiter.
        setTimeout(() => {
          send(ws, {
            type: 'CONNECTED',
            protocol: { name: 'oip', version: '0.1' },
            session_id: connectedSessionId,
            status: scenario === 'mode-disconnect' && connects > 1 ? 'connected' : 'idle',
            session_modes: {
              currentModeId: currentMode,
              availableModes: [
                { id: ':read-only', name: 'Read only' },
                { id: ':workspace', name: 'Auto' },
                { id: ':danger-full-access', name: 'Full access' },
              ],
            },
          })
          send(ws, { type: 'AGENT_PROFILE', ...profile })
          // Pushed on connect for agents that ship one. Its arrival is what flips
          // hasDashboard, which is what splits the workspace in two.
          if (scenario === 'dashboard' || scenario === 'dashboard-approval' || scenario === 'dashboard-drains' || scenario === 'dashboard-error' || scenario === 'dashboard-drop' || scenario === 'pr-evidence') send(ws, { type: 'DASHBOARD_SNAPSHOT', html: DASHBOARD_HTML })
        }, 0)

        // The connection goes away after it was working: a tunnel, a handover
        // between wifi and cellular, the screen locking. Closed here rather than
        // on INPUT because sending from the landing page navigates to the session
        // page, which opens a *fresh* socket — an INPUT-triggered close lands on
        // the socket already being torn down and the session never notices.
        return
      }

      if (scenario === 'pr-evidence' && msg.type === 'ONBOARD_SUBMIT') {
        onboarded = true
        send(ws, { type: 'ONBOARD_SUCCESS', level: 'contact', message: 'Invite accepted' })
        send(ws, {
          type: 'CONNECTED',
          protocol: { name: 'oip', version: '0.1' },
          session_id: connectedSessionId,
          status: 'idle',
          session_modes: {
            currentModeId: currentMode,
            availableModes: [
              { id: ':read-only', name: 'Read only' },
              { id: ':workspace', name: 'Auto' },
              { id: ':danger-full-access', name: 'Full access' },
            ],
          },
        })
        send(ws, { type: 'AGENT_PROFILE', ...profile })
        send(ws, { type: 'DASHBOARD_SNAPSHOT', html: DASHBOARD_HTML })
        return
      }

      if (msg.type === 'mode_change') {
        const modeId = msg.mode
        if (!modeId) return

        if (scenario === 'mode-reject') {
          send(ws, { type: 'ERROR', code: -32000, message: 'Session is busy' })
          return
        }
        if (scenario === 'mode-disconnect') {
          ws.close({ code: 1006, reason: 'connection lost before permission profile acknowledgement' })
          return
        }

        const acknowledge = () => {
          currentMode = modeId
          send(ws, {
            type: 'mode_changed',
            session_id: connectedSessionId,
            mode: modeId,
          })
        }
        if (scenario === 'mode-delay') pendingModeAcknowledgement = acknowledge
        else acknowledge()
        return
      }

      if (
        scenario === 'full-access-checkpoint'
        && msg.type === 'INTERRUPT'
      ) {
        send(ws, {
          type: 'OUTPUT',
          result: 'Full access run ended.',
          session: { session_id: connectedSessionId },
        })
        return
      }

      if (msg.type === 'PROVIDER_INTERRUPT') {
        if (
          msg.invocationId === 'codex:call-7'
          && codingAgentInputs > 0
          && (
            scenario === 'coding-agent'
            || scenario === 'coding-agent-completed'
            || scenario === 'coding-agent-failed'
            || scenario === 'coding-agent-long-approval'
            || scenario === 'coding-agent-stale-approval'
            || scenario === 'coding-agent-stop-ack-no-terminal'
            || scenario === 'coding-agent-stop-delayed-ack'
            || scenario === 'coding-agent-stop-fresh-state'
            || scenario === 'coding-agent-stop-rejected'
          )
        ) {
          const respondToInterrupt = () => {
            const accepted = scenario !== 'coding-agent-stop-rejected'
            send(ws, {
              type: 'PROVIDER_INTERRUPT_ACK',
              requestId: msg.requestId,
              invocationId: 'codex:call-7',
              accepted,
              stateRevision: msg.stateRevision,
              ...(!accepted && { reason: 'not_active' }),
            })
            if (!accepted) {
            // A reconnect can replay the approval snapshot immediately after a
            // rejected interrupt. The UI must keep this invocation unconfirmed
            // until OIP provides a fresh, correlated provider-state revision.
            send(ws, {
              type: 'provider_invocation', invocationId: 'codex:call-7',
              parentToolCallId: 'call-7', provider: 'codex',
              providerDisplayName: 'Codex', status: 'awaiting_approval',
              currentSummary: 'Waiting for your decision',
              stateRevision: msg.stateRevision,
            })
            send(ws, {
              type: 'approval_needed', id: 'approval-codex-after-stop-reject', tool: 'codex',
              arguments: {}, provider: 'codex', invocationId: 'codex:call-7',
              parentToolCallId: 'call-7', activityId: 'review',
              providerApproval: {
                action: 'Inspect the workspace',
                scope: 'This Work Room only',
                reason: 'Check the requested workspace result before continuing',
                scopeClassification: 'workroom',
                allowOnce: true,
                allowSession: false,
                files: ['sort.c', 'test_sort.c'],
              },
            })
              return
            }
            if (scenario === 'coding-agent-stop-ack-no-terminal' || scenario === 'coding-agent-stop-delayed-ack') {
            // The Host ACK is not a terminal provider event. A stale/replayed
            // approval must remain hidden until the provider itself reports a
            // fresh terminal state.
            send(ws, {
              type: 'provider_invocation', invocationId: 'codex:call-7',
              parentToolCallId: 'call-7', provider: 'codex',
              providerDisplayName: 'Codex', status: 'awaiting_approval',
              currentSummary: 'Waiting for your decision',
              stateRevision: msg.stateRevision,
            })
            send(ws, {
              type: 'approval_needed', id: 'approval-codex-after-stop-ack', tool: 'codex',
              arguments: {}, provider: 'codex', invocationId: 'codex:call-7',
              parentToolCallId: 'call-7', activityId: 'review',
              providerApproval: {
                action: 'Inspect the workspace',
                scope: 'This Work Room only',
                reason: 'Check the requested workspace result before continuing',
                scopeClassification: 'workroom',
                allowOnce: true,
                allowSession: false,
                files: ['sort.c', 'test_sort.c'],
              },
            })
              return
            }
            if (scenario === 'coding-agent-stop-fresh-state') {
              // This is a genuinely newer Host state, not a replay. It proves
              // that the previous Stop barrier can be released and lets the
              // reader act on the new, explicitly parked approval.
              send(ws, {
                type: 'provider_invocation', invocationId: 'codex:call-7',
                parentToolCallId: 'call-7', provider: 'codex',
                providerDisplayName: 'Codex', status: 'awaiting_approval',
                currentSummary: 'Waiting for your decision',
                stateRevision: typeof msg.stateRevision === 'number'
                  ? msg.stateRevision + 1
                  : 2,
              })
              send(ws, {
                type: 'approval_needed', id: 'approval-codex-after-fresh-state', tool: 'codex',
                arguments: {}, provider: 'codex', invocationId: 'codex:call-7',
                parentToolCallId: 'call-7', activityId: 'review',
                providerApproval: {
                  action: 'Inspect the workspace',
                  scope: 'This Work Room only',
                  reason: 'Check the requested workspace result before continuing',
                  scopeClassification: 'workroom',
                  allowOnce: true,
                  allowSession: false,
                  files: ['sort.c', 'test_sort.c'],
                },
              })
              return
            }
            send(ws, {
              type: 'provider_invocation', invocationId: 'codex:call-7',
              parentToolCallId: 'call-7', provider: 'codex',
              providerDisplayName: 'Codex', status: 'cancelled',
              currentSummary: 'The provider stopped',
              resultSummary: 'The provider stopped',
              stateRevision: typeof msg.stateRevision === 'number'
                ? msg.stateRevision + 1
                : 2,
            })
          }
          if (scenario === 'coding-agent-stop-delayed-ack') {
            // Makes the in-flight Host state observable. A fast Promise alone
            // cannot prove the header, button and live region agree while it
            // is actually waiting for authority.
            setTimeout(respondToInterrupt, 1_000)
          } else {
            respondToInterrupt()
          }
        }
        return
      }

      if (msg.type !== 'INPUT') return

      if (scenario === 'pr-evidence') {
        send(ws, { type: 'thinking', id: 'evidence-thinking', status: 'done' })
        send(ws, {
          type: 'OUTPUT',
          result: `Completed the release prompt: ${msg.prompt}`,
          session: { session_id: connectedSessionId },
        })
        send(ws, { type: 'DASHBOARD_SNAPSHOT', html: UPDATED_DASHBOARD_HTML })
        return
      }

      // Keep the turn running until the test presses Stop. The mock records the
      // resulting OIP frame; React, not O Chat, owns that wire contract.
      if (scenario === 'cancel') {
        send(ws, { type: 'thinking', id: 't1', status: 'running' })
        return
      }

      if (scenario === 'plan') {
        planInputs += 1
        const entries = planInputs === 1
          ? [
              { content: 'Inspect history', priority: 'high', status: 'completed' },
              { content: 'Implement the React boundary', priority: 'medium', status: 'in_progress' },
              {
                content: 'Verify current-plan-panel-does-not-overflow-at-375px-with-a-long-unbroken-identifier',
                priority: 'low',
                status: 'pending',
              },
            ]
          : planInputs === 2
            ? [{ content: 'Replacement step', priority: 'high', status: 'in_progress' }]
            : []
        send(ws, { type: 'plan', session_id: connectedSessionId, entries })
        send(ws, { type: 'OUTPUT', result: `Plan update ${planInputs}`, session: { session_id: connectedSessionId } })
        return
      }

      // Credit is spent while the run goes on. The agent republishes its profile
      // with the new balance, which is the only way the reader learns before it
      // runs out — the number they saw on arrival is already stale.
      if (scenario === 'balance-drains' || scenario === 'dashboard-drains') {
        send(ws, { type: 'thinking', id: 't1', status: 'done' })
        send(ws, { type: 'OUTPUT', result: 'Working on it.', session: { session_id: connectedSessionId } })
        setTimeout(() => send(ws, { type: 'AGENT_PROFILE', ...profile, balance_usd: 0.35 }), 1200)
        // …and then the reader tops up, which the agent republishes in turn.
        setTimeout(() => send(ws, { type: 'AGENT_PROFILE', ...profile, balance_usd: 20 }), 3200)
        return
      }

      // An agent that starts open and gates partway through. There is a
      // conversation behind this one, so it must keep the in-transcript card
      // rather than getting the wall — the thread has to stay readable.
      if (scenario === 'gate-midway') {
        send(ws, { type: 'ONBOARD_REQUIRED', methods: ['invite_code'] })
        return
      }

      // The connection goes away mid-run: a tunnel, a wifi/cellular handover, the
      // screen locking. Dropped on INPUT rather than on CONNECT because both the
      // landing page and the session page open a socket, and only the one that has
      // received an INPUT is certainly the session's — closing on CONNECT can kill
      // the landing page's socket, which is about to be discarded anyway, and the
      // session then sits there perfectly connected.
      // Once, then the tunnel ends. A scenario that drops every socket can show
      // the disconnected state but never whether the way back out of it works —
      // reconnect would reopen straight into another drop.
      if ((scenario === 'drop' || scenario === 'dashboard-drop') && !dropped) {
        dropped = true
        send(ws, { type: 'thinking', id: 't1', status: 'done' })
        setTimeout(() => ws.close({ code: 1006, reason: 'connection lost' }), 800)
        return
      }

      if (scenario === 'error-once') {
        terminalErrorInputs += 1
        if (terminalErrorInputs === 1) {
          send(ws, { type: 'ERROR', message: 'temporary agent failure' })
          return
        }
      }

      if (scenario === 'error' || scenario === 'dashboard-error') {
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
      if (scenario === 'full-access-checkpoint' && !fullAccessCheckpointSent) {
        fullAccessCheckpointSent = true
        send(ws, { type: 'full_access_checkpoint', id: 'full-access-checkpoint-1', turns_used: 20, max_turns: 100 })
        return
      }

      send(ws, { type: 'thinking', id: 't1', status: 'running' })

      if (scenario === 'coding-agent' || scenario === 'coding-agent-completed' || scenario === 'coding-agent-failed' || scenario === 'coding-agent-long-approval' || scenario === 'coding-agent-stale-approval' || scenario === 'coding-agent-stop-ack-no-terminal' || scenario === 'coding-agent-stop-delayed-ack' || scenario === 'coding-agent-stop-fresh-state' || scenario === 'coding-agent-stop-rejected') {
        codingAgentInputs += 1
        if (codingAgentInputs > 1) {
          send(ws, {
            type: 'provider_invocation', invocationId: 'codex:call-8',
            parentToolCallId: 'call-8', provider: 'codex',
            providerDisplayName: 'Codex', taskTitle: 'Implement and verify the requested change',
            currentSummary: 'Working in the selected workspace',
            sessionId: 'codex-session-1', status: 'running', stateRevision: 1,
          })
          send(ws, {
            type: 'provider_activity', provider: 'codex', activityId: 'changelog', sequence: 1,
            kind: 'file_change', status: 'completed', title: 'Update workspace files',
            summary: 'Workspace files updated', files: ['changelog.md'],
            parentToolCallId: 'call-8', invocationId: 'codex:call-8',
          })
          send(ws, {
            type: 'provider_invocation', invocationId: 'codex:call-8',
            parentToolCallId: 'call-8', provider: 'codex',
            providerDisplayName: 'Codex', taskTitle: 'Implement and verify the requested change',
            sessionId: 'codex-session-1', status: 'completed', elapsedMs: 900,
            stateRevision: 2,
            resultSummary: 'The provider completed its run',
          })
          send(ws, {
            type: 'OUTPUT', result: 'Changelog updated.',
            session: { session_id: connectedSessionId },
          })
          return
        }
        const taskSummary = 'Work inside /private/tmp/codex-workroom. Create sort.c and test_sort.c, compile with cc -std=c11 -Wall -Wextra -Werror, run sorting fixtures, inspect the output, and report the raw command transcript.'
        send(ws, {
          type: 'tool_call', id: 'call-7', name: 'codex',
          args: { prompt: taskSummary }, status: 'running',
        })
        send(ws, {
          type: 'provider_invocation', invocationId: 'codex:call-7',
          parentToolCallId: 'call-7', provider: 'codex',
          providerDisplayName: 'Codex', taskTitle: 'Build and verify the requested C program',
          taskSummary, currentSummary: 'Working in the selected workspace',
          permissionMode: 'manual', sessionId: 'codex-session-1', status: 'running', stateRevision: 1,
        })
        const steps = [
          ['inspect-task', 'inspect', 'Inspect the workspace', 'Workspace inspection completed'],
          ['create-sort', 'file_change', 'Update workspace files', 'Workspace files updated', ['sort.c']],
          ['create-tests', 'file_change', 'Update workspace files', 'Workspace files updated', ['test_sort.c']],
          ['compile', 'command', 'Compile the requested C11 program', 'Compiled the requested C11 program'],
          ['fixture-one', 'command', 'Run the requested tests', 'Completed the requested tests'],
          ['fixture-two', 'command', 'Run the requested tests', 'Completed the requested tests'],
          ['test-suite', 'command', 'Run the requested tests', 'Completed the requested tests'],
          ['review', 'inspect', 'Inspect the workspace', 'Inspecting workspace context'],
        ] as const
        for (const [index, [activityId, kind, title, summary, files]] of steps.entries()) {
          const activityStatus = scenario === 'coding-agent-completed'
            ? 'completed'
            : scenario === 'coding-agent-failed'
              ? index === steps.length - 1 ? 'failed' : 'completed'
              : index === steps.length - 1 ? 'running' : 'completed'
          send(ws, {
            type: 'provider_activity', provider: 'codex', activityId, sequence: index + 1,
            kind, status: activityStatus, title, summary,
            ...(files && { files }),
            parentToolCallId: 'call-7', invocationId: 'codex:call-7',
          })
        }
        if (scenario === 'coding-agent-long-approval' || scenario === 'coding-agent-stale-approval') {
          if (scenario === 'coding-agent-long-approval') {
            send(ws, {
              type: 'provider_invocation', invocationId: 'codex:call-7',
              parentToolCallId: 'call-7', provider: 'codex',
              providerDisplayName: 'Codex', status: 'awaiting_approval',
              currentSummary: 'Waiting for your decision',
              stateRevision: 2,
            })
          }
          send(ws, {
            type: 'approval_needed', id: 'approval-codex-long', tool: 'codex',
            arguments: {},
            provider: 'codex', invocationId: 'codex:call-7',
            parentToolCallId: 'call-7', activityId: 'review',
            providerApproval: {
              action: 'Inspect the workspace',
              scope: 'This Work Room only',
              reason: 'Check the requested workspace result before continuing',
              scopeClassification: 'workroom',
              allowOnce: true,
              allowSession: false,
              files: ['sort.c', 'test_sort.c'],
            },
          })
          return
        }
        if (scenario === 'coding-agent-completed') {
          send(ws, {
            type: 'provider_invocation', invocationId: 'codex:call-7',
            parentToolCallId: 'call-7', provider: 'codex',
            providerDisplayName: 'Codex', status: 'completed', elapsedMs: 1_250,
            currentSummary: 'Completed the provider run after the recorded compilation and test checks',
            resultSummary: 'Completed the provider run after the recorded compilation and test checks',
            stateRevision: 2,
          })
        }
        if (scenario === 'coding-agent-failed') {
          send(ws, {
            type: 'provider_invocation', invocationId: 'codex:call-7',
            parentToolCallId: 'call-7', provider: 'codex',
            providerDisplayName: 'Codex', status: 'failed', elapsedMs: 800,
            errorSummary: 'The provider reported an error',
            stateRevision: 2,
          })
        }
        return
      }

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
        setTimeout(() => {
          send(ws, { type: 'approval_needed', ...approvalEvent })
        }, 5000)
        return
      }

      if (scenario === 'approval') {
        // The run parks here: no OUTPUT until the reader answers. That is the state
        // the approval card exists for, and the one worth a screenshot.
        send(ws, { type: 'approval_needed', ...approvalEvent })
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
          session: { session_id: connectedSessionId },
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
          session: { session_id: connectedSessionId },
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
        session: { session_id: connectedSessionId },
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
        // Offline means no route at all. Emptying `endpoints` while still
        // advertising a relay leaves the agent perfectly reachable — the SDK
        // derives `online` from having somewhere to dial, not from a field — so
        // this scenario reported "online" and never once produced the state it
        // is named for. Nothing used it, which is why nobody noticed.
        endpoints: scenario === 'offline' ? [] : ['https://scriptbot.example'],
        relay: scenario === 'offline' ? null : 'wss://oo.openonion.ai/ws',
        last_seen: new Date(0).toISOString(),
        profile,
      }),
    })
  )

  await page.route(/\/info(\?|$)/, route =>
    route.fulfill({
      status: scenario === 'offline' ? 503 : 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
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

  return {
    /** Handshakes seen so far. */
    connects: () => connects,
    /** Frames of one type, in order. */
    sent: (type: string) => sent.filter(f => f.type === type),
    /** Release a deliberately parked Host permission acknowledgement. */
    acknowledgeMode: () => {
      const acknowledge = pendingModeAcknowledgement
      pendingModeAcknowledgement = null
      acknowledge?.()
    },
    /** Session identity the Host echoed from CONNECT. */
    sessionId: () => activeSessionId,
  }
}

/** A second agent, so agent-to-agent isolation can be observed at all. */
export const SECOND_ADDRESS =
  '0xb0b0feed4f1b8d3a6c5e9f2b1a4d7c8e0f3a6b9c2d5e8f1a4b7c0d3e6f9a1234'

export const SECOND_PROFILE = {
  ...PROFILE,
  address: SECOND_ADDRESS,
  name: 'Ledgerbot',
  balance_usd: 9.5,
  tools: ['read_file', 'search'],
  skills: [{ name: 'reconcile', description: 'Reconcile yesterday’s ledger' }],
}

/**
 * Two agents on one browser, each answering as itself.
 *
 * Everything else in this suite runs against a single agent, which cannot show
 * the failure that matters here: one agent's conversation appearing under
 * another. Each reply names its author, so a leak is visible in the transcript
 * rather than having to be inferred from which pane is showing.
 *
 * Routed by `payload.to` on the CONNECT frame — both agents' sockets match the
 * same URL pattern, so the address in the handshake is what tells them apart.
 */
export async function mockTwoAgents(page: Page) {
  const byAddress = (address: string) =>
    address === SECOND_ADDRESS ? SECOND_PROFILE : PROFILE

  await page.routeWebSocket(url => !url.pathname.includes('_next'), ws => {
    let target = AGENT_ADDRESS

    ws.onMessage(raw => {
      const msg = JSON.parse(String(raw)) as {
        type: string
        prompt?: string
        to?: string
      }

      if (msg.type === 'CONNECT') {
        target = msg.to ?? AGENT_ADDRESS
        const profile = byAddress(target)
        send(ws, {
          type: 'CONNECTED', protocol: { name: 'oip', version: '0.1' },
          session_id: `e2e-${profile.name}`, status: 'idle',
        })
        send(ws, { type: 'AGENT_PROFILE', ...profile })
        return
      }

      if (msg.type !== 'INPUT') return

      send(ws, { type: 'thinking', id: 't1', status: 'done' })
      send(ws, {
        type: 'OUTPUT',
        // Naming the author is the whole point: "you said X" from the wrong agent
        // is indistinguishable from the right one.
        result: `${byAddress(target).name} here. You said: ${msg.prompt}`,
        session: { session_id: `e2e-${byAddress(target).name}` },
      })
    })
  })

  await page.route(/oo\.openonion\.ai\/api\/agents\/(0x[0-9a-f]+)/, route => {
    const address = route.request().url().match(/(0x[0-9a-f]+)/)![1]
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        endpoints: [],
        relay: 'wss://oo.openonion.ai/ws',
        last_seen: new Date(0).toISOString(),
        profile: byAddress(address),
      }),
    })
  })

  await page.route(/\/api\/auth$/, route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-token', public_key: '0xe2e' }),
    })
  )
}
