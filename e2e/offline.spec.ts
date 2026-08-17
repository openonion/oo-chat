/**
 * An agent that cannot be reached, from a session link.
 *
 * The landing page and session route must say so plainly and disable every send
 * path. An invite-only Host can determine the caller's invite status only after
 * authenticated CONNECT, so an offline browser must not invent a code form or
 * send a message that turns into a raw transport/address error (#189).
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

import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the landing page says the agent is offline', async ({ page }) => {
    await mockAgent(page, 'offline')
    await page.goto(`/${AGENT_ADDRESS}`)

    // Guards the scenario as much as the page: if this stops failing to reach the
    // offline state, every test below it silently becomes a test of an online agent.
    await expect(page.getByText(/temporarily offline/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByPlaceholder(/agent offline/i)).toBeDisabled()
  })

  test('a session link says it too', async ({ page, shot }) => {
    await mockAgent(page, 'offline')
    await page.goto(`/${AGENT_ADDRESS}/forwarded-while-offline`)

    await expect(pane(page).getByText(PROFILE.name).first()).toBeVisible({ timeout: 20_000 })

    // Scoped to the pane. Unscoped, `/offline/i` matches two elements and the
    // first is the drawer's "ALL AGENTS OFFLINE" label — hidden, off-screen, and
    // it reports "expected visible, received hidden", which reads exactly like
    // the notice not rendering. That is how a working version of this fix got
    // reported as not working.
    await expect(
      pane(page).getByText(/temporarily offline/i),
      'a session link into an unreachable agent still invites a message',
    ).toBeVisible({ timeout: 15_000 })
    await expect(pane(page).getByPlaceholder(/agent offline/i)).toBeDisabled()
    await expect(pane(page).getByRole('button', { name: 'Send message' })).toBeDisabled()
    await expect(pane(page).getByText(/Agent error:|Agent not connected: 0x/i)).toHaveCount(0)

    await shot('offline-session')
  })

  test('offline outranks a low balance', async ({ page }) => {
    await mockAgent(page, 'offline', { balance_usd: 0.2 })
    await page.goto(`/${AGENT_ADDRESS}/broke-and-offline`)
    await expect(pane(page).getByText(PROFILE.name).first()).toBeVisible({ timeout: 20_000 })

    // Credit is irrelevant to an agent that cannot be reached, and two stacked
    // warnings above a composer read as noise rather than one thing to act on.
    await expect(pane(page).getByText(/temporarily offline/i)).toBeVisible({ timeout: 15_000 })
    await expect(pane(page).getByText(/running low/i)).toHaveCount(0)
  })

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
