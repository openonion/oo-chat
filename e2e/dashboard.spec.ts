/**
 * Home and Chat, and the switch between them.
 *
 * On a phone the two panes are exclusive — one is `hidden` while the other shows —
 * so the switch is not a convenience, it is the only way back. It is rendered
 * through a portal into a slot the layout above owns, looked up once on mount.
 * If that lookup ever misses, a reader who lands on Home is stuck on Home with a
 * dashboard whose buttons do nothing, and nothing on screen says why.
 *
 * On a desktop both panes are visible at once and the question is different:
 * collapsing Home must not take the chat with it.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('an agent with a dashboard opens on Home and can get back to Chat', async ({ page, shot }) => {
    await mockAgent(page, 'dashboard')
    await page.goto(`/${AGENT_ADDRESS}`)

    const switcher = page.getByRole('tab', { name: 'Home' })
    await expect(switcher, 'the view switch never rendered — Home would be a dead end').toBeVisible({ timeout: 15_000 })
    await shot('home')

    // Home first, per defaultMobileView.
    await expect(page.frameLocator('iframe').getByText('Deploy board')).toBeVisible()

    await page.getByRole('tab', { name: 'Chat' }).click()
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
    await shot('chat')

    // And back again — the switch works in both directions, not just away from Home.
    await page.getByRole('tab', { name: 'Home' }).click()
    await expect(page.frameLocator('iframe').getByText('Deploy board')).toBeVisible()
  })

  test('the dashboard fits the viewport it is given', async ({ page }) => {
    await mockAgent(page, 'dashboard')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 15_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'the dashboard pane pushes the page sideways').toBeLessThanOrEqual(0)

    const box = await page.locator('iframe').boundingBox()
    expect(box!.width, 'the dashboard is wider than the phone').toBeLessThanOrEqual(375)
  })

  test('an agent with no dashboard gets no switch and lands in the chat', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

    // A switch with nothing to switch to is worse than no switch.
    await expect(page.getByRole('tab', { name: 'Home' })).toHaveCount(0)
  })
})

test.describe('desktop', () => {
  test('both panes show at once, and collapsing Home keeps the chat', async ({ page, shot }) => {
    await mockAgent(page, 'dashboard')
    await page.goto(`/${AGENT_ADDRESS}`)

    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.frameLocator('iframe').getByText('Deploy board')).toBeVisible()
    await shot('split')

    await page.getByRole('button', { name: /collapse dashboard/i }).click()
    await expect(page.locator('iframe')).toBeHidden()
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

    // The reopen strip is the only way back; without it the pane is gone for good.
    await page.getByRole('button', { name: /open dashboard/i }).click()
    await expect(page.frameLocator('iframe').getByText('Deploy board')).toBeVisible()
  })
})

test.describe('a run that stops while the reader is on Home', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  /** Settle on the session page, then move to Home before the approval lands. */
  async function waitOnHome(page: import('@playwright/test').Page) {
    await mockAgent(page, 'dashboard-approval')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByRole('button', { name: 'What can you do?' }).click()
    // The tool card means the session page has mounted and the socket is live —
    // switching before this races the navigation and silently tests the landing page.
    await expect(page.getByText('check the kernel')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: 'Home' }).click()
    await expect(page.getByRole('tab', { name: /^Home/ })).toHaveAttribute('aria-selected', 'true')
  }

  test('the Chat tab says the agent is waiting', async ({ page, shot }) => {
    await waitOnHome(page)

    // On a phone the two panes are exclusive, so a reader on Home cannot see that
    // the run has parked. The agent is blocked until they answer, and the only
    // thing on screen is a dashboard that does not change. Without a marker here
    // the run simply never proceeds.
    const chatTab = page.getByRole('tab', { name: /Chat/ })
    await expect(
      chatTab.locator('[data-attention]'),
      'nothing on Home says the run has stopped and is waiting for an answer',
    ).toBeVisible({ timeout: 15_000 })

    await shot('waiting')
  })

  test('the marker speaks the same status language as the transcript', async ({ page }) => {
    await waitOnHome(page)
    const dot = page.getByRole('tab', { name: /Chat/ }).locator('[data-attention]')
    await expect(dot).toBeVisible({ timeout: 15_000 })

    // ToolStatus draws brand-500 for "the agent is working" and neutral-400 for
    // "parked on the reader". This dot means the second, and the header already
    // spends brand-500 on the online indicator two elements to the left — so a
    // green dot here would have read as a third meaning for the same mark.
    const colour = await dot.evaluate(el => getComputedStyle(el).backgroundColor)
    expect(colour, 'the waiting marker is drawn in the colour that means "running"').not.toBe('rgb(34, 197, 94)')
  })

  test('it is announced, not only drawn', async ({ page }) => {
    await waitOnHome(page)

    // A dot is invisible to a screen reader. The tab's accessible name has to
    // carry it, or the one reader who cannot see the marker is the one left
    // waiting on a run that is waiting on them.
    await expect(page.getByRole('tab', { name: /Chat.*waiting/i })).toBeVisible({ timeout: 15_000 })
  })

  test('answering it clears the marker', async ({ page }) => {
    await waitOnHome(page)
    const chatTab = page.getByRole('tab', { name: /Chat/ })
    await expect(chatTab.locator('[data-attention]')).toBeVisible({ timeout: 15_000 })

    await chatTab.click()
    await page.getByRole('button', { name: /allow once/i }).first().click()

    // A marker that outlives the thing it marks trains the reader to ignore it.
    await expect(chatTab.locator('[data-attention]')).toHaveCount(0)
  })

  test('a run that needs nothing shows no marker', async ({ page }) => {
    await mockAgent(page, 'dashboard')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: 'Home' }).click()

    // The marker earns its meaning by being absent the rest of the time.
    await expect(page.getByRole('tab', { name: /Chat/ }).locator('[data-attention]')).toHaveCount(0)
  })
})
