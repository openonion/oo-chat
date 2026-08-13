/**
 * The WebSocket mock is a test boundary, so prove it independently of the UI.
 *
 * A many-core local production run once let eight simultaneous full-page PNG
 * captures starve the next wave of pages. Two product tests timed out on the
 * offline transition state even though their mocked CONNECT eventually arrived.
 * This test exercises the configured four-way concurrency directly and makes a
 * missing interception fail as a Host-handshake error with routed URLs/frames.
 */

import { expect, test } from './fixtures'
import { AGENT_ADDRESS, mockAgent, PROFILE } from './mock-agent'

test('a missing mock connection reports the protocol boundary, not a UI timeout', async ({ page }) => {
  const agent = await mockAgent(page)

  await expect(agent.waitUntilReady(25)).rejects.toThrow(
    /mock Host did not complete.*connects=0.*sockets=none.*frames=none/
  )
})

test('four isolated browser contexts complete their page-local mock handshake', async ({ browser, page }) => {
  const extraContexts = await Promise.all(
    Array.from({ length: 3 }, () => browser.newContext({ viewport: { width: 390, height: 844 } }))
  )
  const pages = [page, ...await Promise.all(extraContexts.map(context => context.newPage()))]

  try {
    const agents = await Promise.all(pages.map(current => mockAgent(current)))
    await Promise.all(pages.map(current => current.goto(`/${AGENT_ADDRESS}`)))
    await Promise.all(agents.map(agent => agent.waitUntilReady()))

    for (const [index, current] of pages.entries()) {
      await expect(
        current.getByRole('heading', { name: PROFILE.name, exact: true }),
        `context ${index + 1} received the mock handshake but did not render its profile`,
      ).toBeVisible({ timeout: 20_000 })
      expect(agents[index].connects()).toBeGreaterThan(0)
      expect(agents[index].socketUrls()).toHaveLength(1)
      expect(agents[index].socketUrls()[0]).toMatch(/^wss?:\/\//)
    }

    // Keep the same evidence pressure as the real suite: four full-page PNGs at
    // once, after all four independent protocol paths have rendered.
    await Promise.all(pages.map(current => current.screenshot({ fullPage: true })))
  } finally {
    await Promise.all(extraContexts.map(context => context.close()))
  }
})
