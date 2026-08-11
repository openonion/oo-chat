/**
 * Which answer actually reaches the agent.
 *
 * The approval prompt is the one place a reader tells an agent whether it may
 * run something. Existing coverage checks that the prompt appears, that all five
 * answers are on screen, and that they are big enough to tap — not one of them
 * checks what pressing them *sends*.
 *
 * That gap is the highest-severity one in this app. The five buttons differ only
 * in the frame they produce; on screen they are five rounded rectangles. Cross
 * two `onClick` handlers in a refactor and the UI looks perfect while an agent
 * runs a command the reader rejected. Nothing would catch it, and on an agent
 * with `bash` the first symptom is the damage.
 *
 * So these assert the wire, not the pixels. The frame shapes were read off a
 * live run rather than off the source, so this is a record of what the agent is
 * actually told.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

/** Get to a parked approval prompt with a scary command behind it. */
async function atAnApproval(
  page: import('@playwright/test').Page,
  scenario: 'approval' | 'legacy-approval' = 'approval',
) {
  const agent = await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByRole('button', { name: /allow once/i })).toBeVisible({ timeout: 20_000 })
  return agent
}

/** label → the ACP option the agent must receive. */
const DECISIONS: [RegExp, string][] = [
  [/allow once/i, 'allow_once'],
  [/trust/i, 'allow_session'],
  [/reject/i, 'reject_soft'],
  [/stop/i, 'reject_hard'],
  [/explain/i, 'reject_explain'],
]

const acpResponse = (optionId: string, sessionId: string) => ({
  type: 'ACP_RESPONSE',
  acpSchema: 'schema-v1.19.0',
  sessionId,
  message: {
    jsonrpc: '2.0',
    id: 'approval-event-1',
    result: { outcome: { outcome: 'selected', optionId } },
  },
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  for (const [label, optionId] of DECISIONS) {
    test(`"${label.source}" sends exactly what it promises`, async ({ page }) => {
      const agent = await atAnApproval(page)

      await page.getByRole('button', { name: label }).first().click()

      await expect
        .poll(() => agent.sent('ACP_RESPONSE'), { timeout: 10_000 })
        .toEqual([acpResponse(optionId, agent.sessionId())])
    })
  }

  test('nothing is answered until the reader answers it', async ({ page, shot }) => {
    const agent = await atAnApproval(page)

    // The run is parked precisely so a human decides. An approval sent by the
    // client on its own — a retry, an effect firing twice — would be the agent
    // being told "yes" by nobody.
    await page.waitForTimeout(3000)
    expect(agent.sent('ACP_RESPONSE'), 'an answer was sent without anyone pressing anything').toEqual([])

    await shot('parked')
  })

  test('answering twice does not send twice', async ({ page }) => {
    const agent = await atAnApproval(page)

    const allow = page.getByRole('button', { name: /allow once/i }).first()
    await allow.click()
    // A double tap is one gesture on a phone, and the second one must not become
    // a second decision about whatever the agent asks next.
    await allow.click({ force: true, timeout: 2000 }).catch(() => {})

    await page.waitForTimeout(2000)
    expect(agent.sent('ACP_RESPONSE'), 'a double tap answered twice').toHaveLength(1)
  })

  test('a legacy-only Host still receives one legacy response', async ({ page }) => {
    const agent = await atAnApproval(page, 'legacy-approval')

    await page.getByRole('button', { name: /allow once/i }).first().click()

    await expect
      .poll(() => agent.sent('APPROVAL_RESPONSE'), { timeout: 10_000 })
      .toEqual([{ type: 'APPROVAL_RESPONSE', approved: true, scope: 'once' }])
  })
})

test.describe('the other decisions that reach the agent', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('an answered question sends the option that was chosen', async ({ page, shot }) => {
    const agent = await mockAgent(page, 'ask-user')
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('Which environment should I deploy to?')).toBeVisible({ timeout: 20_000 })

    // The two options are adjacent rounded rectangles and the agent acts on the
    // answer. Sending the wrong one deploys to production because someone tapped
    // staging — the same class of failure as a crossed approval handler, on a
    // control that carries arbitrary agent-defined choices.
    await page.getByRole('button', { name: 'production', exact: true }).click()

    await expect
      .poll(() => agent.sent('ASK_USER_RESPONSE'), { timeout: 10_000 })
      .toEqual([{ type: 'ASK_USER_RESPONSE', answer: 'production' }])

    await shot('answered')
  })

  test('the other option sends the other answer', async ({ page }) => {
    const agent = await mockAgent(page, 'ask-user')
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('Which environment should I deploy to?')).toBeVisible({ timeout: 20_000 })

    // Asserting one option proves the wiring exists; asserting both proves it
    // distinguishes. A handler that always sent the first option would pass the
    // test above.
    await page.getByRole('button', { name: 'staging', exact: true }).click()

    await expect
      .poll(() => agent.sent('ASK_USER_RESPONSE'), { timeout: 10_000 })
      .toEqual([{ type: 'ASK_USER_RESPONSE', answer: 'staging' }])
  })

  test('a trust chip tells the agent which mode it is in', async ({ page }) => {
    const agent = await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // The chip reads "accept" and the mode is "accept_edits" — a label that is
    // not its value is exactly what a rename breaks silently, and the mode is
    // what decides whether the agent asks before it edits.
    await page.getByRole('button', { name: 'accept', exact: true }).click()
    await page.getByRole('button', { name: 'plan', exact: true }).click()

    await expect
      .poll(() => agent.sent('mode_change'), { timeout: 10_000 })
      .toEqual([
        { type: 'mode_change', mode: 'accept_edits' },
        { type: 'mode_change', mode: 'plan' },
      ])
  })
})

test.describe('the gate and the turn limit', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  /** Stand in front of a gate that takes either a code or a payment claim. */
  async function atTheGate(page: import('@playwright/test').Page) {
    const agent = await mockAgent(page, 'onboard-payment')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 })
    return agent
  }

  test('an invite code is submitted as a code, and signed', async ({ page }) => {
    const agent = await atTheGate(page)

    await page.getByRole('textbox').first().fill('DEMO-1234')
    await page.getByRole('button', { name: /continue/i }).first().click()

    await expect.poll(() => agent.sent('ONBOARD_SUBMIT').length, { timeout: 10_000 }).toBe(1)
    const frame = agent.sent('ONBOARD_SUBMIT')[0] as {
      payload: { invite_code?: string; payment?: number }
      from?: string
      signature?: string
    }

    expect(frame.payload.invite_code, 'the code that was typed is not what was sent').toBe('DEMO-1234')
    // The two branches of this gate are one keystroke apart in the handler and
    // mean completely different things: "here is my code" versus "I have paid
    // you". Sending the wrong one is a door that will not open, or a claim about
    // money nobody made.
    expect(frame.payload.payment, 'a code submission also claimed a payment').toBeUndefined()

    // The host verifies the caller before it answers, so an unsigned submission is
    // refused and the reader sees a gate that rejects a code they typed correctly.
    expect(frame.from, 'the submission is anonymous').toBeTruthy()
    expect(frame.signature, 'the submission is unsigned').toBeTruthy()
  })

  test('a payment claim is submitted as a claim, not a code', async ({ page, shot }) => {
    const agent = await atTheGate(page)

    await page.getByRole('button', { name: /sent it/i }).click()

    await expect.poll(() => agent.sent('ONBOARD_SUBMIT').length, { timeout: 10_000 }).toBe(1)
    const frame = agent.sent('ONBOARD_SUBMIT')[0] as {
      payload: { invite_code?: string; payment?: number }
      signature?: string
    }

    // The amount the gate asked for. This is an assertion the reader signs, which
    // the agent then decides whether to believe — so it has to say what they
    // actually claimed, and carry their signature.
    expect(frame.payload.payment, 'the claimed amount is not the amount asked for').toBe(12)
    expect(frame.payload.invite_code, 'a payment claim smuggled an invite code').toBeUndefined()
    expect(frame.signature, 'the claim is unsigned').toBeTruthy()

    await shot('paid')
  })

  test('continuing an autonomous run says how much more rope', async ({ page }) => {
    const agent = await mockAgent(page, 'ulw-turns')
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('Completed 20 of 100 turns')).toBeVisible({ timeout: 20_000 })

    await page.getByRole('button', { name: /continue/i }).first().click()

    // The one prompt where the agent has been working unattended and is asking to
    // carry on. An action without its budget would be an unbounded grant.
    await expect
      .poll(() => agent.sent('ULW_RESPONSE'), { timeout: 10_000 })
      .toEqual([{ type: 'ULW_RESPONSE', action: 'continue', turns: 100 }])
  })
})
