import { test as base, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Where a UI review looks. One flat, stably-named folder beats digging through
 *  `test-results/<mangled-test-name>/`, and it survives a green run — which is the
 *  point: a passing suite cannot tell you a control turned white on white. */
export const SHOTS_DIR = 'e2e-screenshots'

/** `some test — does a thing` → `some-test-does-a-thing` */
export const slug = (title: string) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

/**
 * Every test photographs itself, whether or not it remembers to.
 *
 * Screenshots used to be a call each spec made by hand, which meant a new spec
 * could ship without one and nobody would notice until a regression went
 * unseen. This fixture makes the shot structural: it fires after the test body
 * on the way out, so the folder always has one frame per test.
 *
 * `shot()` remains available for the states *inside* a test that are worth
 * keeping — a card before and after expanding, say.
 */
export const test = base.extend<{ shot: (name: string) => Promise<void> }>({
  shot: async ({ page }, use, info) => {
    await use(async (name: string) => {
      const path = `${SHOTS_DIR}/${slug(info.title)}--${name}.png`
      const body = await page.screenshot({ fullPage: true, path })
      await info.attach(name, { body, contentType: 'image/png' })
    })
  },

  page: async ({ page }, use, info) => {
    await use(page)

    // After the body, before teardown. Wrapped because a test that closed the
    // page or crashed the browser must still report its own failure rather than
    // this one — the screenshot is evidence, not an assertion.
    try {
      if (page.isClosed()) return
      const path = `${SHOTS_DIR}/${slug(info.title)}.png`
      const body = await page.screenshot({ fullPage: true, path })
      await info.attach('final', { body, contentType: 'image/png' })
    } catch (error) {
      const path = `${SHOTS_DIR}/${slug(info.title)}.MISSING.txt`
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, `no screenshot: ${String(error)}\n`)
    }
  },
})

export { expect }

/** The conversation pane — what is actually in front of the reader.
 *
 *  Reach for this instead of `page.getByText(...)`. The sidebar renders the same
 *  words as the pane (an agent's name, a session title, "offline"), and when the
 *  drawer is closed those copies are still in the DOM at `visibility: hidden`,
 *  off-screen. An unscoped locator finds them first, and the failure it produces
 *  is "expected visible, received hidden" — which reads exactly like the feature
 *  being broken.
 *
 *  That has now cost five tests across this suite, and once cost a working fix
 *  being reported as not working. */
export function pane(page: import('@playwright/test').Page) {
  return page.locator('main')
}
