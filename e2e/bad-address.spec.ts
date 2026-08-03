/**
 * A link with a broken address in it.
 *
 * #108 taught Settings and the root picker to refuse an address that is not one.
 * The URL was never checked, and the URL is how a bad address actually arrives:
 * a shared link that clipped its last characters, or one mangled by a mail
 * client. Visiting it rendered a complete agent page — name, balance, Top up,
 * openers — and the auto-add effect quietly wrote the broken string into the
 * stored agent list, where it stays.
 *
 * So the validation added in #108 was bypassable by the one route most likely to
 * carry the mistake.
 */

import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

const TRUNCATED = '0xe2e7e57a9e0c4f1b8d3a6c5e9f2b1a4d7c8e0f3a6b9c2d5e8f1a4b7c0d3e6'

function storedAgents(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('oo-chat-storage')
    return raw ? (JSON.parse(raw).state?.agents ?? []) : []
  })
}

/** Every route that takes an address, and a URL that exercises it.
 *
 *  Enumerated from the filesystem rather than listed by hand: #109 fixed
 *  /[address] and left /[address]/[sessionId] rendering a working composer for
 *  the same broken link, because the rule was applied to the route I happened to
 *  be looking at. A new route under [address] now fails this until it handles a
 *  malformed address too. */
const ADDRESS_ROUTES: [string, (a: string) => string][] = [
  ['/[address]', a => `/${a}`],
  ['/[address]/[sessionId]', a => `/${a}/some-session`],
]

test('every route under [address] is covered by this spec', async () => {
  const { execSync } = await import('node:child_process')
  const found = execSync("find app -path '*[[]address[]]*' -name 'page.tsx' | sort", { encoding: 'utf8' })
    .split('\n').filter(Boolean)
    .map(f => f.replace(/^app/, '').replace(/\/page\.tsx$/, ''))

  expect(
    found.sort(),
    'a route under [address] is not exercised with a malformed address — add it to ADDRESS_ROUTES',
  ).toEqual(ADDRESS_ROUTES.map(([r]) => r).sort())
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  for (const [label, address] of [
    ['a truncated address', TRUNCATED],
    ['nonsense', 'not-an-address'],
  ] as const) {
    test(`${label} in the URL is not silently adopted`, async ({ page }) => {
      await mockAgent(page)
      await page.goto(`/${address}`)
      await page.waitForTimeout(3000)

      // The list is what the sidebar, Settings and the picker all read. A broken
      // string in there outlives the visit and cannot be told apart from a real
      // agent that happens to be offline.
      expect(await storedAgents(page), 'a broken address was written to the agent list').not.toContain(address)
    })

    for (const [route, url] of ADDRESS_ROUTES) {
    test(`${label} at ${route} says the link is wrong`, async ({ page, shot }) => {
      await mockAgent(page)
      await page.goto(url(address))

      // Not "offline" — the address is malformed, which is a different problem
      // with a different fix, and only one of them is the reader's to act on.
      await expect(
        pane(page).getByText(/not a valid agent/i),
        'a malformed link renders as a working agent page',
      ).toBeVisible({ timeout: 20_000 })

      await expect(pane(page).getByPlaceholder(/message/i)).toHaveCount(0)

      await shot(`${label.replace(/\s+/g, '-')}${route.includes('sessionId') ? '-session' : ''}`)
    })
    }
  }

  test('a real address is unaffected', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)

    // The guard has to be exact: this is the whole product.
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(pane(page).getByPlaceholder(/message/i)).toBeVisible()
    await expect.poll(() => storedAgents(page), { timeout: 10_000 }).toContain(AGENT_ADDRESS)
  })
})
