/**
 * A transcript with several kinds of tool in it.
 *
 * One card on its own never shows whether the rows share a grammar. Four in a
 * row did: `DONE (0.2S)`, `EXIT CODE 0 (4.2S)` and `PROCESSING` were set in
 * bold uppercase at tracking-widest and pulsing, so on a phone the status of a
 * tool that had already finished was louder than the agent's actual answer —
 * and grep's meta wrapped onto a second line, making that row taller than its
 * neighbours for no reason a reader could see.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

async function busyTranscript(page: import('@playwright/test').Page) {
  await mockAgent(page, 'busy')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText(/build finished in 4\.2 seconds/)).toBeVisible({ timeout: 20_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('no tool row shouts, and none of them wrap', async ({ page, shot }) => {
    await busyTranscript(page)

    // The four rows are read as a column; if one is much taller than the others
    // it is because its title or its meta wrapped.
    const rows = page.locator('[role="log"]').getByText(/^(done|exit 0|running|awaiting approval)/)
    const heights: number[] = []
    for (const row of await rows.all()) {
      const box = await row.boundingBox()
      if (box) heights.push(box.height)
    }
    expect(heights.length, 'no tool meta rendered at all').toBeGreaterThan(1)
    expect(Math.max(...heights), 'a tool row wrapped onto a second line').toBeLessThan(Math.min(...heights) * 1.8)

    await shot('busy')
  })

  test('status meta is quiet — not uppercase, not animated', async ({ page }) => {
    await busyTranscript(page)

    const loud = await page.evaluate(() =>
      [...document.querySelectorAll('[role="log"] span')]
        .filter(el => {
          const s = getComputedStyle(el)
          const text = (el.textContent || '').trim()
          if (!text || text.length > 30) return false
          return s.textTransform === 'uppercase' || s.animationName.includes('pulse')
        })
        .map(el => (el.textContent || '').trim().slice(0, 30))
    )
    // A finished tool's status is reference material. Uppercase at wide tracking
    // is a shout, and animating text delays reading the word that matters.
    expect(loud, 'a tool status is still shouting or blinking').toEqual([])
  })

  test('every tool name starts on the same rail', async ({ page }) => {
    await busyTranscript(page)

    // Cards carry different numbers of leading icons — bash has a chevron, a
    // status and a terminal glyph; read_file has no chevron; grep has no tool
    // icon — so without a reserved rail their titles started up to 26px apart
    // and the left edge of the transcript read as ragged.
    const xs = await page.evaluate(() =>
      [...document.querySelectorAll('[role="log"] span')]
        .filter(el => /^(Read_file|Bash|write_file|grep)$/.test((el.textContent || '').trim()))
        .map(el => Math.round(el.getBoundingClientRect().x))
    )
    expect(xs.length, 'no tool titles found').toBeGreaterThan(2)
    expect(Math.max(...xs) - Math.min(...xs), 'tool titles are not on one rail').toBeLessThanOrEqual(4)
  })

  test('nothing in a busy transcript pushes the page sideways', async ({ page }) => {
    await busyTranscript(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test('the chevron is the state — no collapsed row shows a body', async ({ page, shot }) => {
  await busyTranscript(page)

  // One rule, and it used to be broken in both directions: grep showed a
  // right-pointing chevron and rendered its matches anyway, while read_file
  // rendered a whole code body with no chevron at all. A control that does not
  // predict what you will see is worse than no control.
  const rows = await page.evaluate(() => {
    const log = document.querySelector('[role="log"]')!
    return [...log.querySelectorAll('[aria-expanded], button')]
      .map(el => {
        const name = [...el.querySelectorAll('span')]
          .map(s => (s.textContent || '').trim())
          .find(t => /^(Read_file|Bash|write_file|grep)$/.test(t))
        if (!name) return null
        const expanded = el.getAttribute('aria-expanded')
        // The body is the next sibling block, if any.
        const body = el.parentElement?.querySelector('pre, .font-mono[class*="bg-"]')
        return { name, expanded, hasBody: !!body }
      })
      .filter(Boolean)
  })

  expect(rows.length, 'no disclosure rows found').toBeGreaterThan(0)
  for (const row of rows as { name: string; expanded: string | null; hasBody: boolean }[]) {
    if (row.expanded === 'false') {
      expect(row.hasBody, `${row.name} says collapsed but renders a body`).toBe(false)
    }
  }

  await shot('collapsed')
})

test('opening a file card is possible at all', async ({ page }) => {
  await busyTranscript(page)

  // read_file had no open/closed state, so its content was permanently on
  // screen and there was nothing to click.
  const header = page.getByRole('button').filter({ hasText: 'Read_file' }).first()
  await expect(header).toHaveAttribute('aria-expanded', 'false')
  await header.click()
  await expect(header).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('hello')).toBeVisible()
})

test('one status mark, drawn one way', async ({ page }) => {
  await busyTranscript(page)

  // There were five implementations of this 14px mark: a literal ✓ text glyph
  // in grep, an icon in a green circle in bash, the same icon in a neutral
  // circle in the shared header, the strings '✓'/'✗'/'●' in three more cards,
  // and an icon-or-nothing pair in generic-card. A text glyph renders at the
  // font's own weight and baseline, which is why grep's check sat visibly
  // heavier and lower than its neighbours in the same column.
  const marks = await page.evaluate(() => {
    const log = document.querySelector('[role="log"]')!
    return [...log.querySelectorAll('span')]
      .filter(el => ['✓', '✗', '●'].includes((el.textContent || '').trim()))
      .map(el => (el.textContent || '').trim())
  })
  expect(marks, 'a status is still drawn as a text character').toEqual([])

  // And the done marks that remain are all the same size, so the rail does not
  // jitter between rows.
  const sizes = await page.evaluate(() => {
    const log = document.querySelector('[role="log"]')!
    return [...log.querySelectorAll('svg')]
      .map(el => el.getBoundingClientRect())
      .filter(r => r.width > 6 && r.width < 20)
      .map(r => Math.round(r.width))
  })
  if (sizes.length > 1) {
    expect(Math.max(...sizes) - Math.min(...sizes), 'status marks are different sizes').toBeLessThanOrEqual(6)
  }
})

test('every tool body hangs off the same rail as its title', async ({ page, shot }) => {
  // Waits for a full run, opens four cards, then screenshots twice — past the
  // 30s default once the fixture's own capture is counted.
  test.setTimeout(90_000)
  await busyTranscript(page)

  for (const button of await page.getByRole('button').filter({ hasText: /Read_file|Bash|grep|write_file/ }).all()) {
    await button.click().catch(() => {})
  }
  await page.waitForTimeout(500)

  // Bodies used to sit on three different rails — ml-5 (20px), ml-7 (28px) and
  // ml-[60px] — so a card's output started somewhere its own title did not,
  // and two adjacent cards indented differently for no reason a reader could see.
  const edges = await page.evaluate(() => {
    const log = document.querySelector('[role="log"]')!
    const out: number[] = []
    for (const el of log.querySelectorAll('div, pre')) {
      const style = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      // Panels only: something with its own surface, big enough to be a body.
      if (r.height > 40 && r.width > 200 && style.backgroundColor !== 'rgba(0, 0, 0, 0)') out.push(Math.round(r.x))
    }
    return [...new Set(out)].sort((a, b) => a - b)
  })

  // Two rails are correct: one for tool bodies, one for the agent's own prose
  // column, which is avatar-aligned and deliberately narrower. Three means the
  // tool bodies disagree with each other — which they did, at 428 and 460.
  //
  // Counting distinct edges rather than measuring a spread, because a spread
  // over a filtered set was my first attempt and it passed on the broken code:
  // the filter I used to exclude the prose column also excluded the disagreement.
  expect(edges.length, `expected two rails, got ${edges.join(', ')}`).toBeLessThanOrEqual(2)

  await shot('expanded')
})

test('desktop keeps the same grammar', async ({ page, shot }) => {
  await busyTranscript(page)
  await expect(page.getByText('exit 0 · 4.2s')).toBeVisible()
  await expect(page.getByText(/^done · 0\.2s$/)).toBeVisible()
  await shot('busy')
})
