/** The agent can stop and ask the reader a question without changing authority. */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

async function run(page: import('@playwright/test').Page) {
  await mockAgent(page, 'ask-user')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
}

test.describe('the agent asks a question', () => {
  test('the question and its options are on screen and answerable', async ({ page, shot }) => {
    await run(page)

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
    await run(page)
    await expect(page.getByText('Which environment should I deploy to?')).toBeVisible({ timeout: 20_000 })

    // The transcript can be scrolled away from; the composer is always in view,
    // so it is what tells a reader the run is waiting on them.
    await expect(page.getByPlaceholder(/answer above/i)).toBeVisible()
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('a question fits and does not push the page sideways', async ({ page, shot }) => {
    await run(page)
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
