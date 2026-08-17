/**
 * The screenshot flow, tested.
 *
 * Every other spec depends on the fixture in `fixtures.ts` firing on the way out.
 * If it silently stopped — a Playwright upgrade changing fixture teardown order,
 * someone "simplifying" the `page` override away — the suite would stay green and
 * the folder a reviewer opens before merging would quietly go empty. Nothing else
 * here would notice, because successful screenshots are evidence rather than an assertion.
 *
 * So the flow gets its own coverage: one passing test proves a frame lands on disk
 * even when it never asks for one, and one proves the whole suite's output is
 * complete rather than partially written.
 */

import { readdir, stat } from 'node:fs/promises'
import { test, expect, SHOTS_DIR, slug } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

// Serial: the second test reads what the first one writes. In parallel the
// checker raced the producer and the run came back flaky.
test.describe.configure({ mode: 'serial' })

test('a passing test that never calls shot() still leaves a screenshot', async ({ page }) => {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)

  // Deliberately no shot() call. The fixture owes us one on the way out, and the
  // next test checks that it arrived — this one only has to produce a page worth
  // photographing.
  await expect(page.getByRole('heading', { name: 'Scriptbot', exact: true })).toBeVisible()
})

test('the folder a reviewer opens is populated after successful screenshots', async ({ shot, page }) => {
  await page.goto('/')
  await shot('picker')

  const files = await readdir(SHOTS_DIR)

  // The run above must have produced its own frame without asking.
  const auto = slug('a passing test that never calls shot() still leaves a screenshot')
  expect(
    files,
    'the fixture stopped screenshotting tests that do not ask — the review folder is now incomplete'
  ).toContain(`${auto}.png`)

})

test('the review folder contains only real screenshots from completed tests', async ({ page }) => {
  await page.goto('/')

  const files = await readdir(SHOTS_DIR)
  const explicit = `${slug('the folder a reviewer opens is populated after successful screenshots')}--picker.png`
  expect(files).toContain(explicit)

  // A path that exists but holds zero bytes is worse than a missing one: it looks
  // like coverage and shows a reviewer nothing.
  for (const file of files.filter(f => f.endsWith('.png'))) {
    const { size } = await stat(`${SHOTS_DIR}/${file}`)
    expect(size, `${file} is empty`).toBeGreaterThan(1000)
  }

})
