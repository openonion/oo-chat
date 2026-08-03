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
async function atAnApproval(page: import('@playwright/test').Page) {
  const agent = await mockAgent(page, 'approval')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByRole('button', { name: /allow once/i })).toBeVisible({ timeout: 20_000 })
  return agent
}

/** label → the frame the agent must receive. */
const DECISIONS: [RegExp, Record<string, unknown>][] = [
  [/allow once/i, { type: 'APPROVAL_RESPONSE', approved: true, scope: 'once' }],
  [/trust/i, { type: 'APPROVAL_RESPONSE', approved: true, scope: 'session' }],
  [/reject/i, { type: 'APPROVAL_RESPONSE', approved: false, scope: 'once', mode: 'reject_soft' }],
  [/stop/i, { type: 'APPROVAL_RESPONSE', approved: false, scope: 'once', mode: 'reject_hard' }],
  [/explain/i, { type: 'APPROVAL_RESPONSE', approved: false, scope: 'once', mode: 'reject_explain' }],
]

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  for (const [label, frame] of DECISIONS) {
    test(`"${label.source}" sends exactly what it promises`, async ({ page }) => {
      const agent = await atAnApproval(page)

      await page.getByRole('button', { name: label }).first().click()

      await expect
        .poll(() => agent.sent('APPROVAL_RESPONSE'), { timeout: 10_000 })
        .toEqual([frame])
    })
  }

  test('nothing is answered until the reader answers it', async ({ page, shot }) => {
    const agent = await atAnApproval(page)

    // The run is parked precisely so a human decides. An approval sent by the
    // client on its own — a retry, an effect firing twice — would be the agent
    // being told "yes" by nobody.
    await page.waitForTimeout(3000)
    expect(agent.sent('APPROVAL_RESPONSE'), 'an answer was sent without anyone pressing anything').toEqual([])

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
    expect(agent.sent('APPROVAL_RESPONSE'), 'a double tap answered twice').toHaveLength(1)
  })
})
