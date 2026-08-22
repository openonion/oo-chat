/**
 * The phone walk-through, end to end.
 *
 * Most people open a shared agent link on a phone, and this path had never been
 * walked at 375px: land, read who the agent is, find its balance, reach the
 * top-up, send a message, answer an approval, open the drawer, switch between
 * Control Center and Chat. Each step here is a thing a user does, not a thing a component
 * renders — and every one of them leaves a screenshot.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

test.use({ viewport: { width: 375, height: 667 } })

/** Nothing may stick out sideways: the transcript clips overflow-x, so anything
 *  wider than the viewport is cut off rather than scrollable. */
async function expectNoSideScroll(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  )
  expect(overflow, 'the page scrolls sideways on a phone').toBeLessThanOrEqual(0)
}

test.describe('landing on a phone', () => {
  test('identity, balance and the way to pay are all reachable without scrolling sideways', async ({ page, shot }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)

    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
    await expectNoSideScroll(page)

    // The balance is the reason someone tops up; it has to be on the page they
    // land on, not only in a settings screen they will never open on a phone.
    const topUp = page.getByRole('link', { name: /top up/i })
    await expect(topUp).toBeVisible()
    await expect(topUp).toHaveAttribute('href', `https://o.openonion.ai/purchase?key=${AGENT_ADDRESS}`)
    await expect(page.getByText(`$${PROFILE.balance_usd.toFixed(2)}`)).toBeVisible()

    await shot('landing')
  })

  test('every control on the landing page is big enough to hit', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

    // WCAG 2.5.8 puts the floor at 24x24. A thumb is not a mouse.
    const small: string[] = []
    for (const el of await page.locator('button:visible, a:visible').all()) {
      const box = await el.boundingBox()
      if (!box) continue
      if (box.width < 24 || box.height < 24) {
        small.push(`${(await el.getAttribute('aria-label')) || (await el.innerText()).trim().slice(0, 30)} — ${Math.round(box.width)}x${Math.round(box.height)}`)
      }
    }
    expect(small, 'targets below the 24px floor').toEqual([])
  })
})

test.describe('a conversation on a phone', () => {
  test('send a message and read the reply', async ({ page, shot }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()

    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 15_000 })
    await expectNoSideScroll(page)
    await shot('reply')
  })

  test('an approval is answerable — primary choices are on screen and hittable', async ({ page, shot }) => {
    await mockAgent(page, 'approval')
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()

    const allow = page.getByRole('button', { name: /allow once/i })
    await expect(allow).toBeVisible({ timeout: 15_000 })
    await expectNoSideScroll(page)

    for (const name of [/allow once/i, /reject this request/i]) {
      const button = page.getByRole('button', { name }).first()
      await expect(button).toBeInViewport()
      const box = await button.boundingBox()
      expect(box!.height, `${name} is too short to tap`).toBeGreaterThanOrEqual(24)
    }
    const reviewOptions = page.locator('summary').filter({ hasText: 'Other review options' })
    await expect(reviewOptions).toBeInViewport()
    const reviewBox = await reviewOptions.boundingBox()
    expect(reviewBox!.height, 'Other review options is too short to tap').toBeGreaterThanOrEqual(24)
    await shot('approval-primary')
    await reviewOptions.click()
    await expect(page.getByRole('button', { name: /reject and ask for an explanation/i })).toBeInViewport()
    await shot('approval-explanation')
  })
})

test.describe('the drawer', () => {
  test('a destructive control is not a thumb-width from a routine one', async ({ page }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: /menu/i }).first().click()

    // Agent actions no longer compete with the identity and status row. The
    // destructive option stays behind one clearly labelled overflow control.
    await expect(page.getByRole('button', { name: /remove agent/i })).toBeHidden()
    await page.getByRole('button', { name: /actions for/i }).first().click()

    const remove = page.getByRole('button', { name: /remove agent/i }).first()
    const newChat = page.getByRole('link', { name: /new chat/i }).first()
    await expect(remove).toBeVisible()

    const [a, b] = [await newChat.boundingBox(), await remove.boundingBox()]
    for (const box of [a, b]) {
      expect(box!.width).toBeGreaterThanOrEqual(24)
      expect(box!.height).toBeGreaterThanOrEqual(24)
    }
    // The old plus and x sat beside one another. Routine and destructive actions
    // now occupy separate full-width rows, so a horizontal thumb slip cannot
    // cross from one into the other.
    expect(b!.y, 'Remove agent is below New chat').toBeGreaterThanOrEqual(a!.y + a!.height)
  })

  test('opens, lists the agent, and closes again', async ({ page, shot }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

    const drawer = page.locator('aside')
    await expect(drawer).toHaveCSS('visibility', 'hidden')

    await page.getByRole('button', { name: /menu/i }).first().click()
    await expect(drawer).toHaveCSS('visibility', 'visible')
    await expect(drawer.getByText(/agents/i).first()).toBeVisible()
    await shot('drawer-open')

    // The scrim is the obvious way back out on a phone.
    await page.locator('.fixed.inset-0').first().click({ position: { x: 340, y: 400 } })
    await expect(drawer).toHaveCSS('visibility', 'hidden')
  })
})
