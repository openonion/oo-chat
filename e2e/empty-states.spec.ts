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

async function openEmptySession(page: import('@playwright/test').Page, sessionId: string) {
  // Exercise the empty *session* surface, not an unknown link that correctly
  // redirects after remote discovery. Otherwise DOM reads race that navigation.
  await page.addInitScript(({ address, sessionId }) => {
    localStorage.setItem('oo-chat-storage', JSON.stringify({
      state: {
        conversations: [{
          sessionId, agentAddress: address, title: 'Local draft',
          createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
        }], agents: [address], activeSessionId: sessionId,
      }, version: 0,
    }))
  }, { address: AGENT_ADDRESS, sessionId })
  await page.goto(`/${AGENT_ADDRESS}/${sessionId}`)
  await expect(page.locator('textarea')).toBeEnabled()
  await expect(page).toHaveURL(new RegExp(`/${sessionId}$`))
}

test('a fresh session offers the same openers the landing page does', async ({ page, shot }) => {
  await mockAgent(page)

  // Straight into a session with an empty transcript — the screen a visitor sees
  // immediately after passing an invite gate.
  await openEmptySession(page, 'fresh-session')
  await expect(page.getByText(/send a message|Connected/i).first()).toBeVisible({ timeout: 20_000 })

  // The exact offer bestOffers() derives from Scriptbot's deploy skill, asserted
  // by name. My first version compared button text between the two pages and
  // passed on the unfixed code, because the sidebar's "Add Agent" appears on
  // both — a comparison loose enough to match anything proves nothing.
  const opener = page.locator('main').getByRole('button', { name: 'Ship the current branch to production' })
  await expect(opener, 'the empty session offers nothing to say').toBeVisible()

  // The universal opener, which is the whole point of the row for a visitor who
  // has just been let in and does not yet know what this agent is for. The
  // landing page leads with it, filled; this screen offered only the
  // skill-derived chips, so the one person who most needs a starting point was
  // the one it did not serve. This test's own name claimed parity while
  // asserting a single skill chip.
  const universal = page.locator('main').getByRole('button', { name: 'What can you do?' })
  await expect(universal, 'the empty session has no opener for someone with no idea what to ask').toBeVisible()

  // And it leads, as it does on the landing page — the offer that always applies
  // sits before the ones that only sometimes do.
  const labels = await universal.locator('..').getByRole('button').allTextContents()
  expect(
    labels.indexOf('What can you do?'),
    'the universal opener is not the first chip',
  ).toBeLessThan(labels.indexOf('Ship the current branch to production'))

  await shot('fresh-session')
})

test('the universal opener sends what it says', async ({ page }) => {
  await mockAgent(page)
  await openEmptySession(page, 'fresh-session-3')
  await expect(page.getByText(/send a message|Connected/i).first()).toBeVisible({ timeout: 20_000 })

  await page.locator('main').getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })
})

test('tapping an opener sends it', async ({ page }) => {
  await mockAgent(page)
  await openEmptySession(page, 'fresh-session-2')
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

test('an agent with no usable chips still offers the universal opener', async ({ page, shot }) => {
  // Skills whose descriptions produce no chip — bestOffers rejects internal
  // utilities outright. The row used to be behind `offers.length > 0`, so for
  // these agents it vanished completely, and the reader with the least to go on
  // got the least help. This is the case the guard was hiding.
  await mockAgent(page, 'reply', {
    skills: [{ name: 'debug_dump', description: 'internal' }],
  })

  await openEmptySession(page, 'fresh-session-4')
  await expect(page.getByText(/send a message|Connected/i).first()).toBeVisible({ timeout: 20_000 })

  const pane = page.locator('main')
  await expect(pane.getByRole('button', { name: 'What can you do?' })).toBeVisible()
  // And nothing derived from a skill that should not be offered.
  await expect(pane.getByRole('button', { name: /debug/i })).toHaveCount(0)

  await shot('no-skills')
})
