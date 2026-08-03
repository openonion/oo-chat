/**
 * Adding an agent by pasting its address.
 *
 * The root picker checks the address is `0x` plus 64 hex characters and says so
 * when it is not. Settings ran `addAgent(trimmed)` on whatever was typed, with
 * no check and no message — so a truncated paste, an email, or a sentence became
 * a permanent entry in the agent list, showing as offline forever and navigating
 * to a route that cannot resolve.
 *
 * Pasting an address out of an email is how these get added, and a paste that
 * clipped the last few characters looks exactly like one that did not.
 */

import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** The agents the store has persisted — what the sidebar and pickers list. */
function storedAgents(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('oo-chat-storage')
    return raw ? (JSON.parse(raw).state?.agents ?? []) : []
  })
}

/** Settings, with one agent already known. */
async function settings(page: import('@playwright/test').Page) {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })
  await page.goto('/settings')
  await expect(page.getByPlaceholder(/paste agent address/i)).toBeVisible({ timeout: 20_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  for (const [label, value] of [
    ['a sentence', 'please add my agent'],
    ['a truncated paste', '0xe2e7e57a9e0c4f1b8d3a6c5e9f2b1a4d7c8e0f3a6b9c2d5e8f1a4b7c0d3e6'],
    ['an email', 'ops@example.com'],
  ] as const) {
    test(`settings refuses ${label}`, async ({ page, shot }) => {
      await settings(page)
      const before = await storedAgents(page)

      await page.getByPlaceholder(/paste agent address/i).fill(value)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1500)

      expect(await storedAgents(page), `"${value}" became an agent`).toEqual(before)
      await expect(
        pane(page).getByText(/valid agent address/i),
        'refused it silently — the reader is left thinking it worked',
      ).toBeVisible()

      // Scrolled into view before the shot: the add form sits at the bottom of a
      // long page, so a message rendered below it is only useful if the reader is
      // actually looking there when they press Add.
      await pane(page).getByText(/valid agent address/i).scrollIntoViewIfNeeded()
      await expect(pane(page).getByText(/valid agent address/i)).toBeInViewport()

      await shot('refused')
    })
  }

  test('settings still accepts a real address', async ({ page, shot }) => {
    await settings(page)
    const other = '0x' + 'a'.repeat(64)

    await page.getByPlaceholder(/paste agent address/i).fill(other)
    await page.keyboard.press('Enter')

    await expect.poll(() => storedAgents(page), { timeout: 10_000 }).toContain(other)
    // And the complaint clears once the input is good.
    await expect(pane(page).getByText(/valid agent address/i)).toHaveCount(0)

    await shot('added')
  })

  test('the root picker still refuses junk', async ({ page }) => {
    await mockAgent(page)
    await page.goto('/')

    // The check that already existed. Sharing it must not lose it.
    const add = page.getByRole('button', { name: /add.*agent/i }).first()
    if (await add.count()) await add.click()
    const field = page.getByPlaceholder(/0x/i).first()
    await expect(field).toBeVisible({ timeout: 15_000 })
    await field.fill('not-an-address')
    await page.keyboard.press('Enter')

    await expect(page.getByText(/valid agent address/i)).toBeVisible()
    expect(await storedAgents(page)).not.toContain('not-an-address')
  })
})
