/**
 * The two panes on a laptop.
 *
 * The dashboard is a resizable pane with a remembered width and `shrink-0`, so
 * it never yields — every pixel the window lacks comes out of the chat. At
 * 1024px, which is a MacBook Air at default scaling or any half-screen window,
 * that left the conversation 237px: narrower than a phone, and the composer's
 * textarea measured **0px wide and not visible**. There is no way to type a
 * message on that screen.
 *
 * A phone gets 375px and works. A laptop got less and did not.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

/** Land on an agent that has a dashboard, at a given window width. */
async function splitAt(page: import('@playwright/test').Page, width: number) {
  await page.setViewportSize({ width, height: 800 })
  await mockAgent(page, 'dashboard')
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.locator('iframe')).toBeVisible({ timeout: 20_000 })
}

for (const width of [1024, 1180, 1280, 1440]) {
  test(`a message can be typed at ${width}px`, async ({ page }) => {
    await splitAt(page, width)

    const field = page.getByPlaceholder(/message/i)
    await expect(field, 'the composer has no field to type in').toBeVisible()

    const box = await field.boundingBox()
    // A low sanity floor, not a design target. The same composer on a 375px phone
    // gives the field 137px, so anything near that is fine; my first version of
    // this asserted 180px, which is a number I made up and which the phone itself
    // would fail. The defect being guarded is 0px and invisible.
    expect(box!.width, `the text field is ${Math.round(box!.width)}px wide`).toBeGreaterThan(100)

    // And it must actually accept text, not merely exist.
    await field.fill('reconcile the july ledger')
    await expect(field).toHaveValue('reconcile the july ledger')
  })
}

test('the dashboard gives way rather than the conversation', async ({ page, shot }) => {
  await splitAt(page, 1024)

  const [frame, main] = await Promise.all([
    page.locator('iframe').boundingBox(),
    page.locator('main').boundingBox(),
  ])
  const chat = main!.width - frame!.width

  // The chat is the primary surface: it keeps its floor and the dashboard takes
  // the shortfall. Both stay on screen — narrowing is not the same as hiding,
  // and the dashboard has its own collapse control for that.
  expect(chat, 'the conversation is narrower than a phone').toBeGreaterThanOrEqual(360)
  expect(frame!.width, 'the dashboard vanished instead of narrowing').toBeGreaterThan(120)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow, 'the split pushes the page sideways').toBeLessThanOrEqual(0)

  await shot('1024')
})

test('a wide window still honours the remembered pane width', async ({ page }) => {
  await splitAt(page, 1440)

  // The floor must not become the layout. With room for both, the dashboard keeps
  // the width the reader dragged it to.
  const frame = await page.locator('iframe').boundingBox()
  expect(frame!.width, 'the dashboard lost its width on a wide screen').toBeGreaterThan(400)
})
