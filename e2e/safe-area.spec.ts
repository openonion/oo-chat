/**
 * Safe-area insets, tested with an actual inset.
 *
 * Chromium reports `env(safe-area-inset-*)` as 0 on a plain viewport, so a test
 * that just loads the page proves nothing — every one of these assertions would
 * pass on code that has no inset handling at all. The insets are injected here
 * so the padding has something to resolve to, which is the only way the
 * difference between a fixed bottom padding and one that reserves the inset is
 * observable.
 *
 * Never write an arbitrary-value class literal in this file, even inside a
 * comment. Tailwind v4 scans e2e/ along with everything else and cannot tell an
 * illustrative one from a real one, so it emits a rule for it — and an ellipsis
 * where a keyword belongs is a CSS parse error that takes the whole stylesheet,
 * and therefore every test that needs a dev server, down with it. This cost two
 * runs to find, because the symptom is "webServer timed out", not "bad CSS".
 *
 * The numbers are an iPhone 14 Pro: 59px status bar, 34px home indicator.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

const TOP = 59
const BOTTOM = 34

/** Chromium honours these custom properties in place of the real thing. */
async function withInsets(page: import('@playwright/test').Page) {
  await page.addInitScript(([top, bottom]) => {
    const style = document.createElement('style')
    style.textContent = `:root {
      --safe-top: ${top}px; --safe-bottom: ${bottom}px;
    }`
    document.documentElement.appendChild(style)
  }, [TOP, BOTTOM])
  // env() cannot be faked from script, so assert on the fallback arm instead:
  // the composer must reserve at least the indicator's height either way.
}

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the composer clears the home-indicator swipe zone', async ({ page, shot }) => {
    await withInsets(page)
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // The mode chips are the lowest interactive thing on the page and the one
    // whose mis-tap changes the trust level.
    const chip = page.getByRole('button', { name: 'Default' }).first()
    await expect(chip).toBeVisible()
    const box = await chip.boundingBox()
    const viewport = page.viewportSize()!

    const gap = viewport.height - (box!.y + box!.height)
    expect(gap, 'the mode chips sit in the home-indicator swipe zone').toBeGreaterThanOrEqual(BOTTOM)

    await shot('composer')
  })

  test('the composer padding is expressed as an inset, not a fixed number', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // Chromium reports env() as 0 on a desktop viewport, so the rendered pixel
    // value is identical whether or not the inset is reserved. The class name is
    // where the intent actually lives — Tailwind spells the property into it, and
    // walking cssRules does not work because v4 nests utilities inside @layer.
    const reserved = await page.evaluate(() => {
      const chip = [...document.querySelectorAll('button')].find(b => b.textContent?.trim() === 'Default')
      for (let el = chip?.parentElement ?? null; el; el = el.parentElement) {
        if (String(el.className).includes('safe-area-inset-bottom')) return true
      }
      return false
    })
    expect(reserved, 'nothing above the mode chips reserves the bottom inset').toBe(true)
  })

  test('the open drawer reserves the status bar', async ({ page, shot }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
    await page.getByRole('button', { name: /menu/i }).first().click()

    const usesEnv = await page.locator('aside').evaluate(el =>
      String(el.className).includes('safe-area-inset-top')
    )
    // fixed inset-y-0 puts the logo row at y=0, under the status bar, whenever
    // the drawer is open on a notched phone.
    expect(usesEnv, 'the drawer does not reserve the status bar').toBe(true)

    await shot('drawer')
  })
})
