/**
 * Offering to attach a file to an agent that will not take one.
 *
 * Agents declare what they accept — `accepted_inputs: { text, images, files }` —
 * and the landing page already reads it, printing "text" for a text-only agent
 * in its inventory panel. The composer never consulted it: the paperclip was
 * comment-labelled "always available" and shown to every agent.
 *
 * So a reader picks a photo, sends it, and the agent refuses. That is the same
 * shape as the invite gate before #96 — a control that invites an action which
 * cannot succeed — and on a phone the paperclip sits under the thumb.
 *
 * Undeclared means allowed. Most agents publish nothing here, and hiding
 * attachments from all of them would be a far worse error than showing one too
 * many.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

async function landOn(page: import('@playwright/test').Page, accepted?: unknown) {
  await mockAgent(page, 'reply', accepted ? ({ accepted_inputs: accepted } as never) : {})
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('an agent that takes only text is not offered attachments', async ({ page, shot }) => {
    await landOn(page, { text: true, images: false })

    await expect(
      page.getByRole('button', { name: /attach file/i }),
      'the paperclip is offered to an agent that will refuse the file',
    ).toHaveCount(0)

    await shot('text-only')
  })

  test('an agent that takes images keeps its paperclip', async ({ page }) => {
    await landOn(page, { text: true, images: true })
    await expect(page.getByRole('button', { name: /attach file/i })).toBeVisible()
  })

  test('an agent that takes files keeps its paperclip', async ({ page }) => {
    await landOn(page, { text: true, images: false, files: { max_file_size_mb: 10 } })
    await expect(page.getByRole('button', { name: /attach file/i })).toBeVisible()
  })

  test('an agent that declares nothing keeps its paperclip', async ({ page }) => {
    await landOn(page)

    // The permissive default, and the case that matters most: almost no agent
    // publishes accepted_inputs today, so reading "undeclared" as "refuses"
    // would take attachments away from nearly everyone.
    await expect(page.getByRole('button', { name: /attach file/i })).toBeVisible()
  })

  test('the same rule applies inside a conversation', async ({ page }) => {
    await landOn(page, { text: true, images: false })
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // The composer on the session route is a second instance of the same
    // component, and the landing page is not where most messages get sent.
    await expect(page.getByRole('button', { name: /attach file/i })).toHaveCount(0)
  })
})
