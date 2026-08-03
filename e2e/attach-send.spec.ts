/**
 * An attachment picked before the conversation exists.
 *
 * Sending from the landing page does not send: it stores the text and navigates
 * to a session, which sends it on arrival. The store carried a bare string, so
 * anything attached alongside was dropped on the way — silently, after the
 * reader had already seen the thumbnail sitting in the composer.
 *
 * Inside a session the same attachment transmits correctly, which is what makes
 * this hard to notice: the feature works everywhere except the first message,
 * and the first message is the one a shared link is for.
 */

import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** A 1x1 PNG — the smallest thing that is genuinely an image. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

async function attach(page: import('@playwright/test').Page) {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: PNG,
  })
  // The thumbnail is the promise being made to the reader.
  await expect(page.locator('img[src^="data:"]').first()).toBeVisible({ timeout: 10_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('an image attached on the landing page reaches the agent', async ({ page, shot }) => {
    const agent = await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })

    await attach(page)
    await shot('attached')

    await page.getByPlaceholder(/message/i).fill('what is in this screenshot')
    await page.keyboard.press('Enter')

    // The whole point of the message. Without the image the agent is answering a
    // question about something it was never shown.
    await expect
      .poll(() => agent.sent('INPUT').some(f => Array.isArray((f as { images?: unknown[] }).images) && (f as { images: unknown[] }).images.length === 1), { timeout: 15_000 })
      .toBe(true)
  })

  test('and the conversation shows it was sent', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })

    await attach(page)
    await page.getByPlaceholder(/message/i).fill('look at this')
    await page.keyboard.press('Enter')

    // Arriving in a session where the image has vanished from the reader's own
    // message is the visible half of the same bug.
    await expect(pane(page).getByText('look at this').first()).toBeVisible({ timeout: 20_000 })
    await expect(pane(page).locator('img[src^="data:"]').first()).toBeVisible({ timeout: 10_000 })
  })

  test('a message with no attachment still sends cleanly', async ({ page }) => {
    const agent = await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(pane(page).getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // Carrying attachments across must not attach an empty array to every message.
    const first = agent.sent('INPUT')[0] as { images?: unknown }
    expect(first.images, 'a plain message now carries an empty images field').toBeUndefined()
  })
})
