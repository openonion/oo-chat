/**
 * An agent that cannot be reached, from a session link.
 *
 * The landing page says so plainly: "This agent is offline — messages may not be
 * delivered." The session route said nothing at all — full composer, opener
 * chips, no warning — so a reader arriving by a forwarded chat URL types into an
 * agent that is not there and waits.
 *
 * Same shape as the invite gate (#96) and the attach button (#102): one route
 * carrying a fact the other has, on the route where most messages are sent. The
 * session half is open — see the issue linked from this file's PR.
 *
 * The `offline` scenario itself had never produced an offline agent. It emptied
 * `endpoints` while still advertising a relay, and still answered CONNECT with a
 * profile — both of which are proof of reachability, and the app was right to
 * treat them as such. Offline means no route and no reply.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the landing page says the agent is offline', async ({ page }) => {
    await mockAgent(page, 'offline')
    await page.goto(`/${AGENT_ADDRESS}`)

    // Guards the scenario as much as the page: if this stops failing to reach the
    // offline state, every test below it silently becomes a test of an online agent.
    await expect(page.getByText(/messages may not be delivered/i)).toBeVisible({ timeout: 20_000 })
  })

  // The session route shows no warning at all — filed as an issue rather than
  // fixed here: keying the notice on `agentInfoMap[address].online === false`
  // did not take effect on that route, and I would rather leave it visibly open
  // than ship a fix I could not make work.

  test('a reachable agent is not accused of being offline', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}/reachable-session`)
    await expect(page.locator('main').getByText(PROFILE.name).first()).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(2000)

    // The other direction: a warning that shows for working agents is worse than
    // none, because it teaches the reader to ignore it.
    await expect(page.getByText(/may not be delivered/i)).toHaveCount(0)
  })
})
