/**
 * The OIP Todo List is current session progress, not authority or approval.
 * Drive the real React reader through its WebSocket boundary so O Chat never gets
 * a chance to pass by parsing the protocol itself.
 */

import { test, expect, selectMode } from './fixtures'
import { AGENT_ADDRESS, mockAgent } from './mock-agent'

async function openPlan(page: import('@playwright/test').Page, detailed = false) {
  const sessionId = 'e2e-session'
  await page.addInitScript(([address, session]) => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        conversations: [{
          sessionId: session,
          title: 'Todo List session',
          agentAddress: address,
          createdAt: new Date(0).toISOString(),
        }],
        activeSessionId: session,
        agents: [address],
      },
      version: 0,
    }))
  }, [AGENT_ADDRESS, sessionId])
  await mockAgent(page, 'todo-list')
  await page.goto(`/${AGENT_ADDRESS}/${sessionId}`)
  await page.getByPlaceholder(/message/i).fill(detailed ? 'Show a detailed plan report' : 'Start the Todo List')
  await page.keyboard.press('Enter')
  return page.getByRole('complementary', { name: 'Current Todo List' })
}

test('full replacements never become transcript rows and an empty Todo List clears', async ({ page, shot }) => {
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

  await page.getByPlaceholder(/message/i).fill('Replace the Todo List')
  await page.keyboard.press('Enter')
  await expect(panel).toContainText('Replacement step')
  await expect(panel).not.toContainText('Inspect history')

  await page.getByPlaceholder(/message/i).fill('Clear the Todo List')
  await page.keyboard.press('Enter')
  await expect(panel).toHaveCount(0)
  await expect(transcript.getByText('Plan update 3')).toBeVisible()
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('long Todo List content stays inside the viewport', async ({ page, shot }) => {
    const panel = await openPlan(page)
    await expect(panel).toBeVisible({ timeout: 20_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'the Todo List panel scrolls the page sideways').toBeLessThanOrEqual(0)

    await shot('mobile')
  })
})

for (const viewport of [{ width: 375, height: 667 }, { width: 1280, height: 720 }]) {
  test(`a long report and current plan keep the composer reachable at ${viewport.width}px`, async ({ page, shot }) => {
    await page.setViewportSize(viewport)
    const panel = await openPlan(page, true)
    await expect(panel).toBeVisible()
    await expect(page.getByRole('log', { name: 'Conversation' })).toContainText('Report section 50')
    await selectMode(page, 'Full access')
    await page.getByRole('button', { name: 'Enable', exact: true }).click()
    await expect(page.getByRole('button', { name: /^Mode: Full access/ })).toBeVisible()
    for (const control of [page.getByPlaceholder(/message/i), page.getByRole('button', { name: /^Mode: Full access/ })]) {
      const box = await control.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.y).toBeGreaterThanOrEqual(0)
      expect(box!.y + box!.height, 'control must stay above the viewport bottom').toBeLessThanOrEqual(viewport.height)
      await control.click({ trial: true })
    }
    await shot('long-report-composer')
  })
}
