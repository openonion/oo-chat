/**
 * The ACP plan is current session state, not transcript history and not approval.
 * Drive the real React reader through its WebSocket boundary so O Chat never gets
 * a chance to pass by parsing the protocol itself.
 */

import { test, expect } from './fixtures'
import { AGENT_ADDRESS, mockAgent } from './mock-agent'

async function openPlan(page: import('@playwright/test').Page) {
  const sessionId = 'e2e-session'
  await page.addInitScript(([address, session]) => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        conversations: [{
          sessionId: session,
          title: 'Plan session',
          agentAddress: address,
          createdAt: new Date(0).toISOString(),
        }],
        activeSessionId: session,
        agents: [address],
      },
      version: 0,
    }))
  }, [AGENT_ADDRESS, sessionId])
  await mockAgent(page, 'plan')
  await page.goto(`/${AGENT_ADDRESS}/${sessionId}`)
  await page.getByPlaceholder(/message/i).fill('Start the plan')
  await page.keyboard.press('Enter')
  return page.getByRole('complementary', { name: 'Current plan' })
}

test('full replacements never become transcript rows and an empty plan clears', async ({ page, shot }) => {
  const panel = await openPlan(page)
  await expect(panel).toBeVisible({ timeout: 20_000 })
  await expect(panel).toContainText('Inspect history')
  await expect(panel).toContainText('Completed')
  await expect(panel).toContainText('High priority')
  await expect(panel).toContainText('In progress')
  await expect(panel).toContainText('Medium priority')
  await expect(panel).toContainText('Pending')
  await expect(panel).toContainText('Low priority')
  await expect(panel.getByRole('button')).toHaveCount(0)

  const transcript = page.getByRole('log', { name: 'Conversation' })
  await expect(transcript.getByText('Inspect history')).toHaveCount(0)
  await shot('initial')

  await page.getByPlaceholder(/message/i).fill('Replace the plan')
  await page.keyboard.press('Enter')
  await expect(panel).toContainText('Replacement step')
  await expect(panel).not.toContainText('Inspect history')

  await page.getByPlaceholder(/message/i).fill('Clear the plan')
  await page.keyboard.press('Enter')
  await expect(panel).toHaveCount(0)
  await expect(transcript.getByText('Plan update 3')).toBeVisible()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('long plan content stays inside the viewport', async ({ page, shot }) => {
    const panel = await openPlan(page)
    await expect(panel).toBeVisible({ timeout: 20_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'the plan panel scrolls the page sideways').toBeLessThanOrEqual(0)

    await shot('mobile')
  })
})
