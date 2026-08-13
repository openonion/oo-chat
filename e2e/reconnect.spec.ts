/**
 * What the reader is told when the connection goes away.
 *
 * This is the ordinary phone failure — a tunnel, a handover between wifi and
 * cellular, the screen locking long enough for the socket to be reaped. The
 * agent stops being reachable and the reader is left looking at a status line.
 *
 * `ModeStatusBar` has a `disconnected` branch with a `reconnect` link, and it was
 * effectively never shown: the state was derived from an HTTP poll that only
 * reports true while the *server* still has a run in flight, so a socket that
 * dropped while the agent was idle fell through to "connected". The reader is
 * told everything is fine, types into a dead socket, and waits.
 *
 * ---
 *
 * Dropping the socket is fiddly and the ways to get it wrong all look like
 * findings. Two that cost real time here:
 *
 *   - Closing on CONNECT can close the *landing page's* socket. Sending a message
 *     navigates to the session page, which opens a fresh one, so the session is
 *     left perfectly connected and the test proves nothing. The drop happens on
 *     INPUT, which only the session's socket receives.
 *   - Reading `readyState` through a `window.WebSocket` shim is not evidence. The
 *     shim caught one of the two sockets, so it reported OPEN for a connection
 *     that had genuinely closed. `console.log` from inside the route handler is
 *     the reliable witness that the close actually ran.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** Send a message, then let the mock close the session's socket underneath it. */
async function dropMidRun(page: import('@playwright/test').Page) {
  await mockAgent(page, 'drop')
  await page.goto(`/${AGENT_ADDRESS}`)
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText('What can you do?').first()).toBeVisible({ timeout: 20_000 })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('a dropped connection is not reported as connected', async ({ page, shot }) => {
    await dropMidRun(page)

    // "connected" beside a socket that is gone is the worst of the options: it is
    // the one state that tells the reader to keep waiting.
    await expect(page.getByText('disconnected', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('connected', { exact: true })).toHaveCount(0)

    await shot('dropped')
  })

  test('and offers a way back, at a size a thumb can hit', async ({ page }) => {
    await dropMidRun(page)

    const reconnect = page.getByRole('button', { name: /reconnect/i })
    await expect(reconnect, 'no way back from a dead connection').toBeVisible({ timeout: 15_000 })

    // It was an 11px underlined word. This is the control someone reaches for
    // one-handed, on a train, having just come out of a tunnel.
    const box = await reconnect.boundingBox()
    expect(box!.height, `reconnect is ${Math.round(box!.width)}x${Math.round(box!.height)}`).toBeGreaterThanOrEqual(44)
  })

  test('a fresh landing page is not accused of being disconnected', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

    // Before anything is sent the transport is legitimately not connected yet.
    // Saying so would put an error state on every first impression.
    await expect(page.getByText('disconnected', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /reconnect/i })).toHaveCount(0)
  })

  test('a healthy conversation still reads as live', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // The other direction: the fix must not start calling working sockets dead.
    await expect(page.getByText('live', { exact: true })).toBeVisible()
    await expect(page.getByText('disconnected', { exact: true })).toHaveCount(0)
  })
})

test.describe('coming back', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('the reconnect link actually restores the session', async ({ page, shot }) => {
    await dropMidRun(page)

    const link = page.getByRole('button', { name: /reconnect/i })
    await expect(link).toBeVisible({ timeout: 15_000 })
    await link.click()

    // Not just a status flipping back — the session has to carry a message again,
    // which is the only thing the reader actually wanted.
    await expect(page.getByText('live', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(link).toHaveCount(0)

    await page.getByPlaceholder(/message/i).fill('are you back?')
    await page.keyboard.press('Enter')
    await expect(page.getByText('You said: are you back?')).toBeVisible({ timeout: 20_000 })

    await shot('recovered')
  })

  test('regaining connectivity reconnects without being asked', async ({ page }) => {
    await dropMidRun(page)
    await expect(page.getByRole('button', { name: /reconnect/i })).toBeVisible({ timeout: 15_000 })

    // The browser's own event, the one that fires when a phone comes out of a
    // tunnel. Nobody should have to notice a status line at the bottom of the
    // screen and tap a word in it to get their agent back.
    await page.evaluate(() => window.dispatchEvent(new Event('online')))

    await expect(page.getByText('live', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /reconnect/i })).toHaveCount(0)
  })

  test('returning to the tab reconnects without being asked', async ({ page }) => {
    await dropMidRun(page)
    await expect(page.getByRole('button', { name: /reconnect/i })).toBeVisible({ timeout: 15_000 })

    // Locking a phone long enough for the socket to be reaped, then unlocking it.
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

    await expect(page.getByText('live', { exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test('a healthy session is not reconnected behind the reader', async ({ page }) => {
    const agent = await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // Counting handshakes, not reading the screen. An earlier version of this test
    // asserted the transcript still said "live" with the message intact, and it
    // passed with the `sessionState !== 'disconnected'` guard deleted — a torn-down
    // and reopened socket looks exactly like one that was never touched. The only
    // thing that can tell them apart is the far end.
    const before = agent.connects()

    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(2000)

    expect(agent.connects(), 'a working socket was torn down and reopened').toBe(before)
    await expect(page.getByText('You said: What can you do?')).toBeVisible()
  })
})
