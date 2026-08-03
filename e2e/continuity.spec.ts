/**
 * Getting back to a conversation you already had.
 *
 * Phones reload tabs without being asked — memory pressure, a restored session,
 * a fat-fingered pull-to-refresh. The transcript lives in localStorage under
 * `co:agent:{address}:session:{id}` rather than on a server, so "still there
 * after a reload" is a property of this app's own storage handling and not
 * something the backend would ever restore for us.
 *
 * All three paths here already work. They are covered because they are the ones
 * that break silently in a store refactor and that nobody would think to check
 * by hand: the failure is a reader coming back to an empty screen where their
 * conversation used to be, and there is no error to notice.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

async function haveAConversation(page: import('@playwright/test').Page) {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('a reload puts the reader back in the same conversation', async ({ page, shot }) => {
    await haveAConversation(page)
    const url = page.url()

    await page.reload()

    // Same session, both sides of the exchange still on screen. A store that
    // hydrated late or keyed wrongly would leave the reader on an empty session
    // at the same URL — no error, just their conversation gone.
    expect(page.url(), 'the reload landed somewhere else').toBe(url)

    // Scoped to the conversation pane: the closed drawer also holds this text as
    // the session's title, hidden, and an unscoped match resolves to that one and
    // reports it as not visible.
    const pane = page.locator('main')
    await expect(pane.getByText('What can you do?').first()).toBeVisible({ timeout: 20_000 })
    await expect(pane.getByText('You said: What can you do?')).toBeVisible()

    await shot('reloaded')
  })

  test('and the conversation can be continued after it', async ({ page }) => {
    await haveAConversation(page)
    await page.reload()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // Restoring the transcript is only half of it — the socket has to come back
    // too, or the reader is looking at a conversation they cannot add to.
    await page.getByPlaceholder(/message/i).fill('still there?')
    await page.keyboard.press('Enter')
    await expect(page.getByText('You said: still there?')).toBeVisible({ timeout: 20_000 })
  })

  test('back from a conversation returns to the agent, intact', async ({ page }) => {
    await haveAConversation(page)

    // Sending navigates, so back is the gesture a phone reader reaches for first.
    await page.goBack()

    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: /top up/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'What can you do?' })).toBeVisible()
  })

  test('a session link this browser has never seen opens, rather than breaking', async ({ page, shot }) => {
    await mockAgent(page)

    // A shared link, or the same link after storage was cleared. There is no
    // transcript to show and that is fine — what matters is that it is a usable
    // page and not a blank one or a redirect loop.
    await page.goto(`/${AGENT_ADDRESS}/11111111-2222-3333-4444-555555555555`)

    // The empty session names the agent in a paragraph rather than a heading —
    // the heading role belongs to the landing page's hero, which this is not.
    await expect(page.locator('main').getByText(PROFILE.name).first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder(/message/i)).toBeVisible()

    await shot('unknown-session')
  })
})
