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
