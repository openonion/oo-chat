/**
 * The mandatory pull-request evidence journey.
 *
 * This is deliberately one continuous browser session. Separate green tests for
 * onboarding, modes, chat, and Control Center cannot prove the hand-offs between
 * them, and cannot produce the one final screenshot a reviewer must inspect.
 */
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

test.use({ viewport: { width: 390, height: 844 } })

test('PR release evidence: invite, prompt, modes, and Control Center', async ({ page, shot }) => {
  test.setTimeout(120_000)
  const agent = await mockAgent(page, 'pr-evidence')

  await page.goto(`/${AGENT_ADDRESS}`)
  const gate = page.getByRole('dialog')
  await expect(gate).toBeVisible({ timeout: 20_000 })
  await gate.getByRole('textbox').fill('RELEASE-1.6.11')
  await shot('01-invite-code')
  await gate.getByRole('button', { name: /continue/i }).click()
  await expect.poll(() => agent.sent('ONBOARD_SUBMIT').length).toBe(1)

  await expect(page.getByRole('tab', { name: 'Control Center' })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('tab', { name: 'Chat' }).click()

  await page.getByRole('button', { name: 'Auto', exact: true }).click()
  await expect.poll(() => agent.sent('mode_change').some(frame => frame.mode === ':workspace')).toBe(true)
  await page.getByRole('button', { name: 'Plan', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Exit plan', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Exit plan', exact: true }).click()
  await page.getByRole('button', { name: 'Full access', exact: true }).click()
  await page.getByRole('button', { name: 'Enable', exact: true }).click()
  await expect.poll(() => agent.sent('mode_change').some(frame => frame.mode === ':danger-full-access')).toBe(true)
  await shot('02-modes-acknowledged')

  const prompt = 'Use the deploy skill to update the Control Center for release 1.6.11'
  await page.getByPlaceholder(/message/i).fill(prompt)
  await page.keyboard.press('Enter')
  await expect(page.getByText(`Completed the release prompt: ${prompt}`)).toBeVisible({ timeout: 20_000 })
  await shot('03-prompt-and-skill')

  await page.getByRole('tab', { name: 'Control Center' }).click()
  await expect(page.frameLocator('iframe').getByText('Release 1.6.11 verified')).toBeVisible({ timeout: 20_000 })
  await expect(page.frameLocator('iframe').getByText(/Invite accepted.*prompt completed.*execution modes acknowledged/)).toBeVisible()
  await shot('complete-flow')
})
