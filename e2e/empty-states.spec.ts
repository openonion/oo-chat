/**
 * The two screens that show up when there is nothing yet.
 *
 * A fresh session is what every visitor sees immediately after passing an invite
 * gate — the first thing the product says once it has let you in. It used to say
 * "Connected — send a message" and stop, asking the reader to think of something
 * themselves in the first five seconds, while the landing page one route away
 * had already worked out three good openers from the agent's own skills.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

test('a fresh session offers the same openers the landing page does', async ({ page, shot }) => {
  await mockAgent(page)

  // Straight into a session with an empty transcript — the screen a visitor sees
  // immediately after passing an invite gate.
  await page.goto(`/${AGENT_ADDRESS}/fresh-session`)
  await expect(page.getByText(/send a message|Connected/i).first()).toBeVisible({ timeout: 20_000 })

  // The exact offer bestOffers() derives from Scriptbot's deploy skill, asserted
  // by name. My first version compared button text between the two pages and
  // passed on the unfixed code, because the sidebar's "Add Agent" appears on
  // both — a comparison loose enough to match anything proves nothing.
  const opener = page.locator('main').getByRole('button', { name: 'Ship the current branch to production' })
  await expect(opener, 'the empty session offers nothing to say').toBeVisible()

  await shot('fresh-session')
})

test('tapping an opener sends it', async ({ page }) => {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}/fresh-session-2`)
  await expect(page.getByText(/send a message|Connected/i).first()).toBeVisible({ timeout: 20_000 })

  await page.locator('main').getByRole('button', { name: 'Ship the current branch to production' }).click()
  await expect(page.getByText(/You said:/)).toBeVisible({ timeout: 15_000 })
})

test('settings with no agents says what to do next', async ({ page, shot }) => {
  // No mock: a browser that has never talked to an agent has an empty list.
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

  // Scoped to main: the sidebar says "No agents yet" too.
  const panel = page.locator('main')
  await expect(panel.getByText(/no agents yet/i)).toBeVisible()
  // "No agents added yet" on its own is a statement of absence with no exit.
  await expect(panel.getByText(/paste an agent's address|open a link someone shared/i)).toBeVisible()

  await shot('settings-empty')
})
