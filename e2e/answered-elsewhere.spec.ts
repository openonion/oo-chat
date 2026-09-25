import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

/**
 * One session open on two devices; the other one answered first. From
 * connectonion 1.8.8b9 the Host refuses this device's late answer with
 * STALE_ANSWER and applies nothing (connectonion#1692). The prompt must close
 * and say it was answered on another device: not stay open for a second tap
 * that could only land on a request nobody here has seen, not claim this
 * device's answer took effect, and not turn into a failed turn.
 */
for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test.describe(name, () => {
    test.describe.configure({ timeout: 120_000 })
    test.use({ viewport })

    test('a refused approval closes as answered on another device', async ({ page, shot }) => {
      const agent = await mockAgent(page, 'stale-approval')
      await page.goto(`/${AGENT_ADDRESS}`)
      await page.getByRole('button', { name: 'What can you do?' }).click()
      const allow = page.getByRole('button', { name: /allow once/i }).first()
      await expect(allow).toBeVisible({ timeout: 20_000 })

      await allow.click()

      await expect(page.getByText('Approval answered on another device')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByRole('button', { name: /allow once/i })).toHaveCount(0)
      expect(agent.sent('APPROVAL_RESPONSE'), 'the refused answer was re-sent').toEqual([
        { type: 'APPROVAL_RESPONSE', approved: true, scope: 'once', request_id: 'approval-event-1' },
      ])
      await expect(page.getByText(/something went wrong|error/i)).toHaveCount(0)
      await shot(`approval-answered-elsewhere-${name}`)
    })

    test('a refused question answer closes as answered on another device', async ({ page, shot }) => {
      const agent = await mockAgent(page, 'stale-ask-user')
      await page.goto(`/${AGENT_ADDRESS}`)
      await page.getByRole('button', { name: 'What can you do?' }).click()
      await expect(page.getByText('Which environment should I deploy to?')).toBeVisible({ timeout: 20_000 })

      await page.getByRole('button', { name: 'staging', exact: true }).click()

      await expect(page.getByText('Question answered on another device')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByRole('button', { name: 'staging', exact: true })).toHaveCount(0)
      expect(agent.sent('ASK_USER_RESPONSE'), 'the refused answer was re-sent').toEqual([
        { type: 'ASK_USER_RESPONSE', answer: 'staging', request_id: 'q1' },
      ])
      await shot(`question-answered-elsewhere-${name}`)
    })
  })
}
