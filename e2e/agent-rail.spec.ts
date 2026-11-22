/**
 * The desktop agent rail.
 *
 * The 280px sidebar took a quarter of a laptop to show, usually, one agent. The
 * rail is 56px of avatars; the names and recent chats the sidebar listed are a
 * hover (or focus) away on each avatar. On a full-screen Control Center it folds
 * to the current agent's circle in the corner and slides out over the page.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

test.use({ viewport: { width: 1440, height: 900 } })

/** Two chats under the agent, so its card has something to show. */
async function withChats(page: import('@playwright/test').Page) {
  await page.addInitScript(addr => {
    const now = Date.now()
    const conversations = [
      { sessionId: 's-late', title: 'Late check-out for the Sunday arrivals', minutes: 12 },
      { sessionId: 's-roster', title: 'Cleaning roster for next week', minutes: 190 },
      { sessionId: 's-refund', title: 'Refund decision for booking 4471', minutes: 60 * 26 },
    ].map(({ sessionId, title, minutes }) => {
      const at = new Date(now - minutes * 60_000).toISOString()
      return { sessionId, title, agentAddress: addr, createdAt: at, updatedAt: at }
    })
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: { conversations, activeSessionId: null, agents: [addr], openonionApiKey: 'e2e-token', userProfile: null },
      version: 0,
    }))
  }, AGENT_ADDRESS)
}

const rail = (page: import('@playwright/test').Page) => page.getByRole('navigation', { name: 'Agents' })
const avatar = (page: import('@playwright/test').Page) => rail(page).getByRole('link', { name: new RegExp(`^${PROFILE.name},`) })

test('the rail is 56px of avatars with Add, Explore and Settings', async ({ page }) => {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(avatar(page)).toBeVisible({ timeout: 20_000 })

  expect((await rail(page).boundingBox())!.width).toBe(56)
  await expect(avatar(page)).toHaveAttribute('aria-current', 'page')
  for (const name of ['Add Agent', 'Explore agents', 'Settings']) {
    await expect(rail(page).getByRole('link', { name })).toBeVisible()
  }
  // No names, no lists: the rail itself is only circles and icons.
  await expect(rail(page).getByText(PROFILE.name)).toBeHidden()
})

test('hovering an avatar shows its name, status and recent chats', async ({ page, shot }) => {
  await withChats(page)
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(avatar(page)).toBeVisible({ timeout: 20_000 })

  await avatar(page).hover()
  const card = page.locator('[data-agent-card]')
  await expect(card).toBeVisible()
  await expect(card.getByText(PROFILE.name)).toBeVisible()
  await expect(card.getByText('Online')).toBeVisible()
  await expect(card.getByRole('link', { name: /Late check-out/ })).toBeVisible()
  await shot('card')

  // The card is reachable: the pointer crosses into it without it closing.
  const chat = card.getByRole('link', { name: /Cleaning roster/ })
  await chat.hover()
  await expect(card).toBeVisible()
  await expect(chat).toHaveAttribute('href', `/${AGENT_ADDRESS}/s-roster`)
})

test('a chat can be deleted from the card', async ({ page }) => {
  await withChats(page)
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await avatar(page).hover()
  const row = page.locator('[data-agent-card] li').filter({ hasText: 'Cleaning roster' })
  await row.hover()
  await row.getByRole('button', { name: 'Delete chat' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Delete this chat?')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

  await avatar(page).hover()
  await expect(page.locator('[data-agent-card]').getByText('Cleaning roster')).toHaveCount(0)
})

test('on the Control Center only one circle shows until hovered', async ({ page, shot }) => {
  await withChats(page)
  await mockAgent(page, 'control-center-starter')
  await page.goto(`/${AGENT_ADDRESS}`)
  const circle = page.getByRole('button', { name: 'Show agents' })
  await expect(circle).toBeVisible({ timeout: 20_000 })
  await expect(rail(page)).toBeHidden()
  const before = (await page.locator('iframe').boundingBox())!

  await circle.hover()
  await expect(rail(page)).toBeVisible()
  await expect(circle).toHaveAttribute('aria-expanded', 'true')
  // An overlay: the page under it does not move.
  expect(await page.locator('iframe').boundingBox()).toEqual(before)
  await avatar(page).hover()
  await expect(page.locator('[data-agent-card]')).toBeVisible()
  await shot('rail-open')

  await page.mouse.move(900, 500)
  await expect(rail(page)).toBeHidden()
})

test('the folded rail opens on focus and closes on Escape', async ({ page }) => {
  await mockAgent(page, 'control-center-starter')
  await page.goto(`/${AGENT_ADDRESS}`)
  const circle = page.getByRole('button', { name: 'Show agents' })
  await expect(circle).toBeVisible({ timeout: 20_000 })

  await circle.focus()
  await expect(rail(page)).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(avatar(page)).toBeFocused()
  await expect(page.locator('[data-agent-card]')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(rail(page)).toBeHidden()
  await expect(circle).toBeFocused()
  await expect(circle).toHaveAttribute('aria-expanded', 'false')
})
