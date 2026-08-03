/**
 * Two agents in one browser.
 *
 * Every other spec runs against a single agent, which cannot show the failure
 * that matters here: one agent's conversation surfacing under another. The store
 * keeps a flat `conversations` array tagged with `agentAddress` and the sidebar
 * groups by that tag, so nothing about the isolation is structural — it is a
 * filter, and a filter is a thing that can be wrong.
 *
 * These are enterprise customers with a handful of agents each, some of which
 * read ledgers. A transcript appearing under the wrong agent is not a bad frame.
 */

import { test, expect } from './fixtures'
import {
  mockTwoAgents,
  AGENT_ADDRESS,
  SECOND_ADDRESS,
  PROFILE,
  SECOND_PROFILE,
} from './mock-agent'

/** Say something to one agent and wait for that agent's own answer. */
async function talkTo(
  page: import('@playwright/test').Page,
  address: string,
  name: string,
  message: string,
) {
  await page.goto(`/${address}`)
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible({ timeout: 20_000 })
  await page.getByPlaceholder(/message/i).fill(message)
  await page.keyboard.press('Enter')
  await expect(page.getByText(`${name} here. You said: ${message}`)).toBeVisible({ timeout: 20_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('each agent answers as itself', async ({ page, shot }) => {
    await mockTwoAgents(page)

    await talkTo(page, AGENT_ADDRESS, PROFILE.name, 'who are you')
    await shot('first')

    await talkTo(page, SECOND_ADDRESS, SECOND_PROFILE.name, 'and you')
    // The first agent's reply must not be sitting in the second one's transcript.
    await expect(page.getByText(`${PROFILE.name} here.`)).toHaveCount(0)

    await shot('second')
  })

  test('a conversation stays under the agent that had it', async ({ page, shot }) => {
    await mockTwoAgents(page)
    await talkTo(page, AGENT_ADDRESS, PROFILE.name, 'first thread')
    await talkTo(page, SECOND_ADDRESS, SECOND_PROFILE.name, 'second thread')

    await page.getByRole('button', { name: /menu/i }).first().click()
    const drawer = page.locator('aside')
    await expect(drawer).toHaveCSS('visibility', 'visible')

    // Both agents listed, each owning its own thread. The store is one flat array
    // tagged by address, so this grouping is a filter rather than a structure.
    await expect(drawer.getByText(PROFILE.name)).toBeVisible()
    await expect(drawer.getByText(SECOND_PROFILE.name)).toBeVisible()

    const first = await drawer.getByText(PROFILE.name).first().boundingBox()
    const second = await drawer.getByText(SECOND_PROFILE.name).first().boundingBox()
    const firstThread = await drawer.getByText('first thread').first().boundingBox()
    const secondThread = await drawer.getByText('second thread').first().boundingBox()

    // Each thread sits below its own agent and above the next one — the ordering
    // is what a reader uses to tell whose conversation this is.
    expect(firstThread!.y, 'the first thread is not under its agent').toBeGreaterThan(first!.y)
    expect(secondThread!.y, 'the second thread is not under its agent').toBeGreaterThan(second!.y)
    expect(firstThread!.y, 'the threads are interleaved between agents').toBeLessThan(second!.y)

    await shot('drawer')
  })

  test('switching agents does not carry the transcript across', async ({ page }) => {
    await mockTwoAgents(page)
    await talkTo(page, AGENT_ADDRESS, PROFILE.name, 'ledger numbers')

    // Landing on the other agent fresh: nothing of the first conversation may be
    // on screen, not the reply and not the message that produced it.
    await page.goto(`/${SECOND_ADDRESS}`)
    await expect(page.getByRole('heading', { name: SECOND_PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })

    // Scoped to the conversation pane, not the page. The closed drawer legitimately
    // still lists the first agent's thread — under the first agent, off-screen at
    // x=-217 with visibility:hidden — and an unscoped `toHaveCount(0)` counts it and
    // reads as a leak. The question is what is in front of the reader.
    const pane = page.locator('main')
    await expect(pane.getByText('ledger numbers')).toHaveCount(0)
    await expect(pane.getByText(`${PROFILE.name} here.`)).toHaveCount(0)
  })

  test('each agent carries its own balance', async ({ page }) => {
    await mockTwoAgents(page)

    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('link', { name: /top up/i })).toContainText(`$${PROFILE.balance_usd.toFixed(2)}`)

    // A balance is what a top-up is addressed to, so showing a stale one from the
    // previously viewed agent would send money to the wrong place.
    await page.goto(`/${SECOND_ADDRESS}`)
    await expect(page.getByRole('link', { name: /top up/i })).toContainText(`$${SECOND_PROFILE.balance_usd.toFixed(2)}`)
    await expect(page.getByRole('link', { name: /top up/i })).toHaveAttribute('href', `https://o.openonion.ai/purchase?key=${SECOND_ADDRESS}`)
  })
})
