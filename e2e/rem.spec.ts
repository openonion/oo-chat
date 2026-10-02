/**
 * `/{agent}/rem` — the owner's private co rem, read from the Host over a signed
 * WIKI_READ and shown alone (connectonion#1637).
 *
 * Before this route, the path fell through to `[sessionId]` and opened a chat
 * session called "wiki" (connectonion#1828), and `co wiki open` pointed people
 * at it. So each state here is asserted as the thing a person sees — the
 * notebook, or a message naming the next step — and never a chat composer, a
 * blank frame, or an "Opening…" that never ends.
 *
 * The Host is the scripted one in mock-agent.ts. Its reply is a synthetic
 * notebook rendered by connectonion's real reader template, so the reader's
 * own inline script, CSS and fragment navigation are exercised inside the
 * sandbox and CSP exactly as a real Host's page would be.
 */

import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

const REM_URL = `/${AGENT_ADDRESS}/rem`

async function expectNoChat(page: Page) {
  await expect(page.getByPlaceholder(/message|agent offline/i)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Send message' })).toHaveCount(0)
}

for (const [label, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test.describe(label, () => {
    test.use({ viewport })

    test(`the owner reads co rem full-page (${label})`, async ({ page, shot }) => {
      const host = await mockAgent(page, 'wiki')
      await page.goto(REM_URL)

      const frame = page.frameLocator('iframe[title="Private co rem"]')
      await expect(frame.getByRole('link', { name: /Ada Lovelace/ }).first()).toBeVisible({ timeout: 30_000 })
      await expectNoChat(page)

      // The reader's own navigation runs inside the frame: a note opens by
      // fragment, and the frame is not reloaded (a second load is blocked).
      await frame.getByRole('link', { name: /Ada Lovelace/ }).first().click()
      await expect(frame.getByRole('heading', { name: 'Ada Lovelace' }).first()).toBeVisible()
      await expect(page.getByText(/tried to leave this page/)).toHaveCount(0)

      // Signed, owner-only read over the session; no chat turn was started.
      const reads = host.sent('WIKI_READ')
      expect(reads.length).toBeGreaterThan(0)
      expect(reads[0]).toHaveProperty('signature')
      expect(host.sent('INPUT')).toHaveLength(0)

      await shot(`rem-${label}`)
    })

    test(`a Host that is offline says so and names the next step (${label})`, async ({ page, shot }) => {
      const host = await mockAgent(page, 'offline')
      await page.goto(REM_URL)

      await expect(page.getByRole('heading', { name: 'Host offline' })).toBeVisible({ timeout: 20_000 })
      await expect(page.getByText('co ai', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
      await expect(page.locator('iframe')).toHaveCount(0)
      await expectNoChat(page)
      expect(host.sent('WIKI_READ')).toHaveLength(0)

      await shot(`rem-offline-${label}`)
    })

    test(`a browser that is not the owner is refused without content (${label})`, async ({ page, shot }) => {
      await mockAgent(page, 'wiki-denied')
      await page.goto(REM_URL)

      await expect(page.getByRole('heading', { name: "Not your agent's co rem" })).toBeVisible({ timeout: 30_000 })
      await expect(page.getByText(/co trust admin add 0x[0-9a-f]{64}/i)).toBeVisible()
      await expect(page.locator('iframe')).toHaveCount(0)
      await expectNoChat(page)

      await shot(`rem-denied-${label}`)
    })
  })
}

test('a Host that gates this browser at connect is shown as not the owner', async ({ page }) => {
  const host = await mockAgent(page, 'onboard-payment')
  await page.goto(REM_URL)

  await expect(page.getByRole('heading', { name: "Not your agent's co rem" })).toBeVisible({ timeout: 30_000 })
  await expect(page.locator('iframe')).toHaveCount(0)
  expect(host.sent('WIKI_READ')).toHaveLength(0)
})

test('a Host without a notebook says how to build one', async ({ page }) => {
  await mockAgent(page, 'wiki-unavailable')
  await page.goto(REM_URL)

  await expect(page.getByRole('heading', { name: 'No co rem notebook on this Host' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('co rem init', { exact: true })).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
})

test('the co rem frame is sandboxed on an opaque origin under a no-network CSP', async ({ page }) => {
  await mockAgent(page, 'wiki')
  await page.goto(REM_URL)

  const iframe = page.locator('iframe[title="Private co rem"]')
  await expect(iframe).toBeVisible({ timeout: 30_000 })
  const sandbox = await iframe.getAttribute('sandbox')
  expect(sandbox).toContain('allow-scripts')
  expect(sandbox).not.toContain('allow-same-origin')
  const srcdoc = (await iframe.getAttribute('srcdoc')) || ''
  const csp = srcdoc.slice(0, srcdoc.indexOf('<body>'))
  expect(csp).toContain("default-src 'none'")
  expect(csp).toContain("connect-src 'none'")

  // Nothing inside the frame can read O Chat's storage, where the browser key lives.
  const origin = await page.frameLocator('iframe[title="Private co rem"]').locator('body')
    .evaluate(() => window.origin)
  expect(origin).toBe('null')
})

test('a reader that replaces itself is still caught, and its own loads are not', async ({ page }) => {
  // The backstop used to count loads, so the frame's own about:blank load
  // before its srcdoc read as "tried to leave" on a reader that had not moved
  // (2026-10-01). It now waits for the reader to say it is ready (frame-watch.ts).
  await mockAgent(page, 'wiki-navigates')
  await page.goto(REM_URL)
  await expect(page.getByText(/tried to leave this page/)).toBeVisible({ timeout: 15_000 })
})

test('a malformed address is not treated as an agent', async ({ page }) => {
  await mockAgent(page, 'wiki')
  await page.goto('/0x1234/rem')
  await expect(page.getByRole('heading', { name: 'That is not a valid agent link' })).toBeVisible()
})

for (const route of ['rem', 'wiki']) {
  test(`${route} bookmarks open the selected co rem note`, async ({ page, shot }) => {
    await mockAgent(page, 'wiki')
    await page.goto(`/${AGENT_ADDRESS}/${route}?from=bookmark#r=people/ada-lovelace.md`)
    await expect(page).toHaveURL(`${REM_URL}?from=bookmark#r=people/ada-lovelace.md`)
    const reader = page.frameLocator('iframe[title="Private co rem"]')
    await expect(reader.getByRole('heading', { name: 'Ada Lovelace', exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(reader.getByRole('heading', { name: 'What your assistant knows', exact: true })).toHaveCount(0)
    await expectNoChat(page)
    await shot(`${route}-bookmark-selected`)
  })
}
