/** Stop is an application action whose wire behavior belongs to @connectonion/react. */

import { type Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

async function atARunningTurn(
  page: Page,
  scenario: 'cancel-acp' | 'cancel-legacy',
) {
  const agent = await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByRole('button', { name: 'Stop agent' })).toBeVisible({
    timeout: 20_000,
  })
  return agent
}

test('Stop delegates negotiated ACP cancellation to the React package', async ({ page }) => {
  const agent = await atARunningTurn(page, 'cancel-acp')

  await page.getByRole('button', { name: 'Stop agent' }).click()

  await expect.poll(() => agent.sent('ACP_NOTIFICATION')).toEqual([{
    type: 'ACP_NOTIFICATION',
    acpSchema: 'schema-v1.19.0',
    message: {
      jsonrpc: '2.0',
      method: 'session/cancel',
      params: { sessionId: agent.sessionId() },
    },
  }])
  expect(agent.sent('INTERRUPT')).toEqual([])
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible()
})

test('Stop keeps the React package legacy fallback for an old Host', async ({ page }) => {
  const agent = await atARunningTurn(page, 'cancel-legacy')

  await page.getByRole('button', { name: 'Stop agent' }).click()

  await expect.poll(() => agent.sent('INTERRUPT')).toEqual([{ type: 'INTERRUPT' }])
  expect(agent.sent('ACP_NOTIFICATION')).toEqual([])
  await expect(page.getByRole('button', { name: 'Send message' })).toBeVisible()
})
