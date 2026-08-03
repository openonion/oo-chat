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

  test('nothing in a busy transcript pushes the page sideways', async ({ page }) => {
    await busyTranscript(page)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test('desktop keeps the same grammar', async ({ page, shot }) => {
  await busyTranscript(page)
  await expect(page.getByText('exit 0 · 4.2s')).toBeVisible()
  await expect(page.getByText(/^done · 0\.2s$/)).toBeVisible()
  await shot('busy')
})
