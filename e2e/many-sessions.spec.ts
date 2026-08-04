/**
 * A sidebar after weeks of use.
 *
 * Everything else in this suite runs with one to three conversations. With
 * forty, the sidebar shows the newest eight and offers "32 older chats →" —
 * pointing at the agent's landing page, which lists **none**. Measured: zero
 * session links in `main`. The source said "the agent page lists the rest"; it
 * does not, and those conversations were unreachable from the interface
 * entirely. For a customer months in, that is their history gone.
 */

import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

const TOTAL = 40

/** Seed a history rather than send forty messages. */
async function withManySessions(page: import('@playwright/test').Page) {
  await page.addInitScript(([addr, total]) => {
    const conversations = Array.from({ length: total as number }, (_, i) => ({
      sessionId: `s-${i}`,
      agentAddress: addr,
      title: `conversation number ${i}`,
      createdAt: new Date(2026, 6, 1 + (i % 28)).toISOString(),
    }))
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        conversations, activeSessionId: null, agents: [addr],
        openonionApiKey: 'e2e-token', userProfile: null,
      },
      version: 0,
    }))
  }, [AGENT_ADDRESS, TOTAL] as const)

  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: /menu/i }).first().click()
  const drawer = page.locator('aside')
  await expect(drawer).toHaveCSS('visibility', 'visible')
  return drawer
}

const sessionRows = (drawer: ReturnType<typeof pane>) => drawer.locator('a[href*="/s-"]')

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the newest few are shown, and the rest are offered', async ({ page, shot }) => {
    const drawer = await withManySessions(page)

    await expect(sessionRows(drawer)).toHaveCount(8)
    await expect(drawer.getByText(/32 older chats/i)).toBeVisible()

    await shot('collapsed')
  })

  test('the older ones can actually be reached', async ({ page, shot }) => {
    const drawer = await withManySessions(page)

    // The promise the sidebar makes. It used to lead to a page listing none of
    // them, which is worse than not offering: the reader is told where their
    // history is and finds an empty room.
    await drawer.getByText(/32 older chats/i).click()

    await expect(
      sessionRows(drawer),
      'the older conversations are still not listed anywhere',
    ).toHaveCount(TOTAL)

    await shot('expanded')
  })

  test('and one of them opens', async ({ page }) => {
    const drawer = await withManySessions(page)
    await drawer.getByText(/32 older chats/i).click()

    // Listing is not reaching. The oldest conversation has to open.
    const oldest = drawer.getByRole('link', { name: 'conversation number 39' })
    await oldest.scrollIntoViewIfNeeded()
    await oldest.click()

    await expect(page).toHaveURL(/\/s-39$/)
  })

  test('a short history offers nothing to expand', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(pane(page).getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: /menu/i }).first().click()

    // The control earns its place by being absent when there is nothing behind it.
    await expect(page.locator('aside').getByText(/older chats/i)).toHaveCount(0)
  })
})
