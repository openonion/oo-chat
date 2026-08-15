/** Stop is an application action whose wire behavior belongs to @connectonion/react. */

import { type Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

async function atARunningTurn(
  page: Page,
) {
  const agent = await mockAgent(page, 'cancel')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByRole('button', { name: 'Stop agent' })).toBeVisible({
    timeout: 20_000,
  })
  return agent
}

test('Stop sends one OIP interrupt through the React package', async ({ page }) => {
  const agent = await atARunningTurn(page)

  await page.getByRole('button', { name: 'Stop agent' }).click()

  await expect.poll(() => agent.sent('INTERRUPT')).toEqual([{ type: 'INTERRUPT' }])
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible()
})
