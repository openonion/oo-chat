/** Auth credentials are runtime state, never browser persistence. */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

test('legacy persisted auth is scrubbed and stays scrubbed after reload', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        conversations: [],
        activeSessionId: null,
        agents: [],
        openonionApiKey: 'legacy-jwt-must-disappear',
        userProfile: { public_key: '0xlegacy', balance_usd: 99 },
      },
      version: 0,
    }))
  })

  await page.route('**/api/auth', async route => {
    const response = route.request().method() === 'POST'
      ? { token: 'runtime-jwt' }
      : { public_key: '0xe2e-user', credits_usd: 4, total_cost_usd: 1, balance_usd: 3 }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
  })
  await mockAgent(page)

  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

  const storedAfterFirstAuth = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('oo-chat-storage') ?? '{}').state ?? {}
  )
  expect(storedAfterFirstAuth).not.toHaveProperty('openonionApiKey')
  expect(storedAfterFirstAuth).not.toHaveProperty('userProfile')

  await page.reload()
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

  const storedAfterReload = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('oo-chat-storage') ?? '{}').state ?? {}
  )
  expect(storedAfterReload).not.toHaveProperty('openonionApiKey')
  expect(storedAfterReload).not.toHaveProperty('userProfile')
})
