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

import { test, expect, pane } from './fixtures'
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

test.describe('what the agent needs the reader to know, from either pane', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  /** Settle in a conversation, switch to Home, and let the credit run down. */
  async function watchingHome(page: import('@playwright/test').Page) {
    await mockAgent(page, 'dashboard-drains')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(pane(page).getByText('Working on it.')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: 'Home' }).click()
    await expect(page.getByRole('tab', { name: /^Home/ })).toHaveAttribute('aria-selected', 'true')
  }

  test('a balance running out is visible from Home', async ({ page, shot }) => {
    await watchingHome(page)

    // #88 gave prompts a marker on the other tab, which is right for something
    // you must answer. This is a standing fact about the agent, and the reader on
    // Home is exactly the person watching a dashboard that is about to stop
    // updating — a breadcrumb pointing at the other pane is not the answer.
    await expect(
      page.getByText(/running low/i),
      'the credit ran out while the reader watched the dashboard, and nothing said so',
    ).toBeVisible({ timeout: 15_000 })

    await shot('home-warned')
  })

  test('and still visible from Chat', async ({ page }) => {
    await watchingHome(page)
    await expect(page.getByText(/running low/i)).toBeVisible({ timeout: 15_000 })

    // Moving it above the panes must not take it away from where it already was.
    await page.getByRole('tab', { name: 'Chat' }).click()
    await expect(page.getByText(/running low/i)).toBeVisible()
    await expect(pane(page).getByPlaceholder(/message/i)).toBeVisible()

    // #85 put this next to the composer precisely so scrolling could not hide
    // it. Above the panes it satisfies that differently — it is outside the
    // scrolling box entirely — but the property has to still hold, so it is
    // asserted rather than argued.
    await page.mouse.move(187, 300)
    for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -120)
    await expect(page.getByText(/running low/i)).toBeInViewport()
  })

  test('a healthy agent shows no notice on either pane', async ({ page }) => {
    await mockAgent(page, 'dashboard')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(pane(page).getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    await expect(page.getByText(/running low|may not be delivered/i)).toHaveCount(0)
    await page.getByRole('tab', { name: 'Home' }).click()
    await expect(page.getByText(/running low|may not be delivered/i)).toHaveCount(0)
  })
})

test.describe('a connection that drops while the reader is on Home', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  async function droppedOnHome(page: import('@playwright/test').Page) {
    await mockAgent(page, 'dashboard-drop')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText(/disconnected/i).first()).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: 'Home' }).click()
    await expect(page.getByRole('tab', { name: /^Home/ })).toHaveAttribute('aria-selected', 'true')
  }

  test('says the connection dropped', async ({ page, shot }) => {
    await droppedOnHome(page)

    // The dashboard cannot update over a dead socket, so it sits there looking
    // like an agent with nothing to report. The composer's status bar says
    // "disconnected · reconnect" — to a reader on Home that is inside the pane
    // they cannot see.
    await expect(
      page.getByText(/connection to this agent dropped/i),
      'the socket died and the dashboard reader was told nothing',
    ).toBeVisible({ timeout: 15_000 })

    await shot('home-disconnected')
  })

  test('and offers the way back', async ({ page }) => {
    await droppedOnHome(page)
    const back = page.getByRole('button', { name: /^reconnect$/i })
    await expect(back).toBeVisible({ timeout: 15_000 })

    await back.click()
    // Recovering must work from here, not just send them to the other pane.
    await expect(page.getByText(/connection to this agent dropped/i)).toHaveCount(0, { timeout: 15_000 })
  })

  test('the chat pane is not told twice', async ({ page }) => {
    await droppedOnHome(page)
    await page.getByRole('tab', { name: 'Chat' }).click()

    // The composer already reports this. Repeating it above the panes for a
    // reader who can read it there is noise, and noise is what teaches people to
    // stop reading notices.
    await expect(page.getByText(/connection to this agent dropped/i)).toHaveCount(0)
    await expect(page.getByText(/disconnected/i).first()).toBeVisible()
  })

  test('a healthy connection says nothing on Home', async ({ page }) => {
    await mockAgent(page, 'dashboard')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Chat' }).click()
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(pane(page).getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('tab', { name: 'Home' }).click()

    await expect(page.getByText(/connection to this agent dropped/i)).toHaveCount(0)
  })
})
