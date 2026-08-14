/** Exact React package events render as one usable nested coding-agent card. */

import { type Page } from '@playwright/test'
import reactPackage from '@connectonion/react/package.json'
import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

async function openCodingRun(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'oo-chat-storage',
      JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 }),
    )
  })
  await mockAgent(page, 'coding-agent')
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(pane(page).getByRole('region', { name: 'Codex running' })).toBeVisible({
    timeout: 15_000,
  })
}

test('provider activity stays nested under one expandable card', async ({ page }) => {
  test.skip(reactPackage.version !== '0.4.2-alpha.3', 'requires the exact React Alpha.3 candidate')
  await openCodingRun(page)

  const card = pane(page).getByRole('region', { name: 'Codex running' })
  await expect(card.getByRole('button', { name: 'Stop Codex' })).toBeVisible()
  await card.getByRole('button', { expanded: false }).click()
  await expect(card.getByRole('list', { name: 'Codex activity' })).toContainText('Bash')
  await expect(card.getByRole('list', { name: 'Codex activity' })).toContainText('pytest -q')
  await expect(pane(page).getByRole('region', { name: 'Codex running' })).toHaveCount(1)
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('expanded provider activity does not overflow the viewport', async ({ page }) => {
    test.skip(reactPackage.version !== '0.4.2-alpha.3', 'requires the exact React Alpha.3 candidate')
    await openCodingRun(page)
    const card = pane(page).getByRole('region', { name: 'Codex running' })
    await card.getByRole('button', { expanded: false }).click()

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, 'provider card scrolls sideways on a phone').toBeLessThanOrEqual(0)
  })
})
