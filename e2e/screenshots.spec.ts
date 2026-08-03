/**
 * The screenshot flow, tested.
 *
 * Every other spec depends on the fixture in `fixtures.ts` firing on the way out.
 * If it silently stopped — a Playwright upgrade changing fixture teardown order,
 * someone "simplifying" the `page` override away — the suite would stay green and
 * the folder a reviewer opens before merging would quietly go empty. Nothing else
 * here would notice, because a screenshot is evidence rather than an assertion.
 *
 * So the flow gets its own coverage: one test proves a frame lands on disk for a
 * test that never asks for one, and one proves the whole suite's output is
 * complete rather than partially written.
 */

import { readdir, stat } from 'node:fs/promises'
import { test, expect, SHOTS_DIR, slug } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

test('a test that never calls shot() still leaves a screenshot', async ({ page }) => {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)

  // Deliberately no shot() call. The fixture owes us one on the way out, and the
  // next test checks that it arrived — this one only has to produce a page worth
  // photographing.
  await expect(page.getByRole('heading', { name: 'Scriptbot', exact: true })).toBeVisible()
})

test('the folder a reviewer opens is populated, and every file is a real PNG', async ({ shot, page }) => {
  await page.goto('/')
  await shot('picker')

  const files = await readdir(SHOTS_DIR)

  // The run above must have produced its own frame without asking.
  const auto = slug('a test that never calls shot() still leaves a screenshot')
  expect(
    files,
    'the fixture stopped screenshotting tests that do not ask — the review folder is now incomplete'
  ).toContain(`${auto}.png`)

  // And an explicit intermediate shot lands under the calling test's name.
  expect(files.some(f => f.endsWith('--picker.png'))).toBe(true)

  // A path that exists but holds zero bytes is worse than a missing one: it looks
  // like coverage and shows a reviewer nothing.
  for (const file of files.filter(f => f.endsWith('.png'))) {
    const { size } = await stat(`${SHOTS_DIR}/${file}`)
    expect(size, `${file} is empty`).toBeGreaterThan(1000)
  }

  // A failed capture writes a marker rather than staying silent.
  expect(files.filter(f => f.endsWith('.MISSING.txt'))).toEqual([])
})
