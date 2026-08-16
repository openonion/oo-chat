/**
 * Removing an agent, from the page that agent is on.
 *
 * Both agent routes carry an effect that adds the address to the store whenever
 * it is missing — that is how visiting a link is what "adds" an agent. Removing
 * the agent while standing on its own page makes `agents` change, the effect
 * re-runs, the address is missing, and it goes straight back in.
 *
 * The destructive half of the removal is not undone by that: the conversations
 * and their transcripts are already deleted. So the reader is left with the
 * agent still listed and its history quietly gone — the worst possible split,
 * because the visible signal says the removal failed.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** The agents the store has persisted, which is what the sidebar and the picker list. */
function storedAgents(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('oo-chat-storage')
    return raw ? (JSON.parse(raw).state?.agents ?? []) : []
  })
}

/** Open the intentionally tucked-away destructive action in the phone drawer. */
async function chooseRemoveAgent(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /menu/i }).first().click()
  const drawer = page.locator('aside')
  await drawer.getByRole('button', { name: /actions for/i }).first().click()
  await drawer.getByRole('button', { name: /remove agent/i }).first().click()
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('stays removed when removed from its own page', async ({ page, shot }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    expect(await storedAgents(page)).toContain(AGENT_ADDRESS)

    await chooseRemoveAgent(page)
    await page.getByRole('button', { name: /^remove$/i }).first().click()

    await expect
      .poll(() => storedAgents(page), { timeout: 10_000 })
      .not.toContain(AGENT_ADDRESS)

    await shot('removed')
  })

  test('its conversations go with it', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    await chooseRemoveAgent(page)
    await page.getByRole('button', { name: /^remove$/i }).first().click()
    await page.waitForTimeout(2000)

    // Transcripts are per-session localStorage entries; orphaned ones eat the
    // ~5MB quota and no flow restores them.
    const leftovers = await page.evaluate(() =>
      Object.keys(localStorage).filter(k => k.startsWith('co:agent:'))
    )
    expect(leftovers, 'transcripts outlived the agent').toEqual([])
  })

  test('visiting an agent link still adds it', async ({ page }) => {
    await mockAgent(page)

    // The other direction, and the reason that effect exists: opening an agent's
    // link is how it gets into the list in the first place. A fix that stops the
    // re-add must not stop this.
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })

    await expect.poll(() => storedAgents(page), { timeout: 10_000 }).toContain(AGENT_ADDRESS)
  })

  test('and it can be added back by opening its link again', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })

    await chooseRemoveAgent(page)
    await page.getByRole('button', { name: /^remove$/i }).first().click()
    await expect.poll(() => storedAgents(page), { timeout: 10_000 }).not.toContain(AGENT_ADDRESS)

    // Removal is not a ban. Opening the link again is the same gesture that added
    // it originally and has to work the same way.
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })
    await expect.poll(() => storedAgents(page), { timeout: 10_000 }).toContain(AGENT_ADDRESS)
  })
})
