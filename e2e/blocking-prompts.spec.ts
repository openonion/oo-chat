/**
 * The two moments a run stops and waits for the reader.
 *
 * Both had no coverage at all. They are the states where the agent has taken
 * itself as far as it can and needs a human — so if either is hard to see, hard
 * to reach on a phone, or silent to a screen reader, the run simply stalls and
 * nothing explains why.
 *
 * `full_access_checkpoint` is the higher-stakes of the two: a fully autonomous run
 * has hit its turn limit and is asking for more rope.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

async function run(page: import('@playwright/test').Page, scenario: 'ask-user' | 'full-access-checkpoint') {
  await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
}

test.describe('the agent asks a question', () => {
  test('the question and its options are on screen and answerable', async ({ page, shot }) => {
    await run(page, 'ask-user')

    await expect(page.getByText('Which environment should I deploy to?')).toBeVisible({ timeout: 20_000 })
    for (const option of ['staging', 'production']) {
      const button = page.getByRole('button', { name: option, exact: true })
      await expect(button).toBeVisible()
      const box = await button.boundingBox()
      expect(Math.min(box!.width, box!.height), `${option} is too small to tap`).toBeGreaterThanOrEqual(24)
    }

    await shot('question')
  })

  test('a blocked run says so in the composer', async ({ page }) => {
    await run(page, 'ask-user')
    await expect(page.getByText('Which environment should I deploy to?')).toBeVisible({ timeout: 20_000 })

    // The transcript can be scrolled away from; the composer is always in view,
    // so it is what tells a reader the run is waiting on them.
    await expect(page.getByPlaceholder(/answer above/i)).toBeVisible()
  })
})

test.describe('an autonomous run hits its limit', () => {
  test('says how far it got and offers a way to continue', async ({ page, shot }) => {
    await run(page, 'full-access-checkpoint')

    // How far it got, against what it was allowed — the fact the reader needs
    // before granting more. A missing max_turns used to render "20 of 0 turns".
    await expect(page.getByText('Completed 20 of 100 turns')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /continue/i }).first()).toBeVisible()

    // And the composer has to say the run is parked. It only knew about approvals
    // and questions, so it still read "Send a message…" here — the one prompt of
    // the three where the agent has been working unattended.
    await expect(page.getByPlaceholder(/answer above/i)).toBeVisible()

    await shot('full-access-limit')
  })

  test('the prompt is announced, not just drawn', async ({ page }) => {
    await run(page, 'full-access-checkpoint')
    await expect(page.getByText(/20/).first()).toBeVisible({ timeout: 20_000 })

    // The transcript is role="log" aria-live="polite", so an appended card is
    // announced. Without that a screen-reader user waits on a run that has
    // already stopped and asked them something.
    const live = page.locator('[role="log"][aria-live]')
    await expect(live).toHaveCount(1)
    await expect(live).toContainText(/20/)
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a question fits and does not push the page sideways', async ({ page, shot }) => {
    await run(page, 'ask-user')
    await expect(page.getByText('Which environment should I deploy to?')).toBeVisible({ timeout: 20_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'the question card pushes the page sideways').toBeLessThanOrEqual(0)

    for (const option of ['staging', 'production']) {
      await expect(page.getByRole('button', { name: option, exact: true })).toBeInViewport()
    }

    await shot('question')
  })
})
