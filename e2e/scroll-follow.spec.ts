/**
 * Following a reply as it arrives, and being left alone while reading back.
 *
 * `ChatMessages` keeps a `stickToBottomRef` and a ResizeObserver on the content:
 * grow the content and it follows, unless the reader has scrolled away from the
 * bottom. Streamed tokens grow items in place rather than appending to `ui`, so
 * the observer watches height, not item count. None of it had a test.
 *
 * Both directions matter and they fail differently. If following breaks, the
 * answer scrolls past below the fold and the reader watches a stale screen. If
 * the release breaks, the transcript rips itself back down every time a token
 * lands and reading back during a run becomes impossible — which on a phone is
 * most of the transcript, most of the time.
 *
 * ---
 *
 * Use a real gesture. `el.scrollTop = 0` does NOT prove anything here: the
 * assignment fires its `scroll` event asynchronously, and with content arriving
 * every ~120ms the ResizeObserver gets there first, slams the position back to
 * the bottom, and the scroll event then reports "at bottom" and re-arms the
 * stick. Measured that way the reader appears unable to scroll up at all — I
 * had it diagnosed as a broken transcript before checking with `mouse.wheel`,
 * where it behaves correctly. The artifact looks exactly like the bug.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

/** The messages viewport. The only scrolling box in the chat tree. */
const SCROLLER = 'div.overflow-y-auto.overflow-x-hidden'

function distanceFromBottom(page: import('@playwright/test').Page) {
  return page.locator(SCROLLER).first().evaluate(
    el => Math.round(el.scrollHeight - el.scrollTop - el.clientHeight)
  )
}

/** Send, then let the staged reply start arriving. */
async function startLongReply(page: import('@playwright/test').Page) {
  await mockAgent(page, 'long-reply')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText('step-1.ts')).toBeVisible({ timeout: 20_000 })
}

/** A real wheel gesture, which is what produces synchronous scroll events.
 *  Waits for something to actually scroll first: wheeling a box that still fits
 *  its content moves nothing, and the assertion that follows then fails for a
 *  reason that has nothing to do with the behaviour under test. */
async function wheelUp(page: import('@playwright/test').Page) {
  await expect
    .poll(() => page.locator(SCROLLER).first().evaluate(el => el.scrollHeight - el.clientHeight), { timeout: 15_000 })
    .toBeGreaterThan(200)

  await page.mouse.move(187, 300)
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(60)
  }
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  // These wait on a reply that arrives over about 3.5 seconds by design — the
  // stick-to-bottom logic watches content height, so a reply delivered in one
  // frame would never exercise it. Add page load and a dev server that may be
  // compiling and the default 30s budget is genuinely tight: this spec has timed
  // out twice on saturated full-suite runs while passing every time in isolation.
  // A timeout is not a race, and raising a budget for work the test really does
  // is not the same as loosening an assertion.
  test.setTimeout(60_000)

  test('a reply that outgrows the screen stays followed to its last line', async ({ page, shot }) => {
    await startLongReply(page)

    // The sentence the agent ends on. If following breaks this is below the fold
    // and the reader is looking at the middle of a finished answer.
    await expect(page.getByText('The last line is the one that matters.')).toBeVisible({ timeout: 20_000 })

    // Polled, not read once. "Settles at the bottom" is an eventual state: under
    // load the observer coalesces and the last pin can land a frame after the
    // text is on screen, which showed up as 100px adrift in a full-suite run and
    // never in isolation. A poll still fails if it never settles.
    await expect
      .poll(() => distanceFromBottom(page), { timeout: 10_000 })
      .toBeLessThanOrEqual(4)

    await shot('followed')
  })

  test('scrolling back does not get undone by the next token', async ({ page, shot }) => {
    await startLongReply(page)
    await wheelUp(page)

    const parked = await distanceFromBottom(page)
    expect(parked, 'the wheel gesture did not move the transcript').toBeGreaterThan(40)

    // The run keeps producing while the reader reads. Nothing may pull them down.
    await page.waitForTimeout(2500)
    const after = await distanceFromBottom(page)
    expect(after, 'new content dragged the reader back to the bottom').toBeGreaterThanOrEqual(parked)

    await shot('parked')
  })

  test('a way back down appears, and only while it is needed', async ({ page }) => {
    await startLongReply(page)

    // Measured after the reply lands, not during it. Mid-stream the button can
    // legitimately flash: a burst of content grows the box before the observer
    // pins it, a scroll event fires past the 80px threshold, and for a frame the
    // reader really is not at the bottom. Asserting its absence at an arbitrary
    // moment during streaming is a race, and it failed exactly that way — on the
    // first run after each edit, when the dev server was still compiling and
    // everything arrived in one lump.
    await expect(page.getByText('The last line is the one that matters.')).toBeVisible({ timeout: 20_000 })

    // Wait for the transcript to actually be at the bottom before asking whether
    // a way back down is offered — while it is still settling the button is
    // correct to be there, and the question being asked is the other one.
    await expect
      .poll(() => distanceFromBottom(page), { timeout: 10_000 })
      .toBeLessThanOrEqual(4)

    const button = page.getByRole('button', { name: /scroll to bottom/i })
    // Nothing to go back to while already there — a permanent button is clutter.
    await expect(button).toHaveCount(0)

    await wheelUp(page)

    // toBeVisible() alone is not enough and would have passed on a button that
    // had drifted out of the transcript's visible box: an element scrolled out of
    // an overflow container still has a box and still counts as visible. The
    // button is positioned `absolute bottom-4` against an ancestor, so where it
    // lands is worth measuring rather than assuming.
    await expect(button).toBeInViewport()

    const box = await button.boundingBox()
    const pane = await page.locator(SCROLLER).first().boundingBox()
    expect(box!.y, 'the way back down sits above the transcript').toBeGreaterThanOrEqual(pane!.y)
    expect(box!.y + box!.height, 'the way back down has drifted below the transcript').toBeLessThanOrEqual(pane!.y + pane!.height)
    expect(Math.min(box!.width, box!.height), `the button is ${box!.width}x${box!.height}`).toBeGreaterThanOrEqual(24)

    await button.click()
    await expect(button).toHaveCount(0)

    // Asserted as "the end of the reply is on screen" rather than as a pixel
    // distance: a smooth scroll settles a few pixels late on a slower machine, and
    // what the reader needs is to be looking at the end of the answer.
    await expect(page.getByText('The last line is the one that matters.')).toBeInViewport()
  })
})
