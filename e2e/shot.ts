import type { Page, TestInfo } from '@playwright/test'

/** Where a UI review looks. One flat, stably-named folder beats digging through
 *  `test-results/<mangled-test-name>/`, and it survives a green run — which is the
 *  point: a passing suite cannot tell you a control turned white on white. */
export const SHOTS_DIR = 'e2e-screenshots'

/**
 * Photograph the current state twice: into the HTML report, so a failure shows it
 * inline, and into {@link SHOTS_DIR}, so `npm run e2e` leaves a folder somebody
 * (or a UI audit) can page through afterwards.
 */
export async function shot(page: Page, info: TestInfo, name: string) {
  const body = await page.screenshot({ fullPage: true, path: `${SHOTS_DIR}/${name}.png` })
  await info.attach(name, { body, contentType: 'image/png' })
}
