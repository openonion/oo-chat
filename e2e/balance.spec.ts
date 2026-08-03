/**
 * Running out of credit, and finding out in time.
 *
 * The balance is shown on the landing page and in Settings — both places you
 * pass through once, before you start working. The conversation, which is where
 * the credit is actually spent, showed nothing at all: an agent could go from
 * working to refusing mid-thread with no warning and no way to pay from the page
 * the reader is on.
 *
 * The pill also rendered `$0.00` in exactly the same neutral grey as `$12.00`,
 * so the one number that means "this is about to stop" looked like chrome.
 */

import { test, expect, pane } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

/** Below this the agent is one or two turns from refusing. */
const LOW = 0.4

async function landing(page: import('@playwright/test').Page, balance: number) {
  await mockAgent(page, 'reply', { balance_usd: balance })
  await page.goto(`/${AGENT_ADDRESS}`)
}

test.describe('the top-up pill', () => {
  test('a healthy balance stays quiet', async ({ page }) => {
    await landing(page, 12)

    const pill = page.getByRole('link', { name: /top up/i })
    await expect(pill).toBeVisible({ timeout: 20_000 })
    await expect(pill).toContainText('$12.00')

    // Nothing about a working agent should read as a problem.
    await expect(pill).not.toContainText(/out of credits/i)
    const colour = await pill.evaluate(el => getComputedStyle(el).borderTopColor)
    expect(colour, 'a healthy balance is drawing attention to itself').not.toMatch(/rgb\(2[0-9][0-9], (1[0-9][0-9]|[0-9][0-9]), /)
  })

  test('an empty balance says so, and still points at the way to fix it', async ({ page, shot }) => {
    await landing(page, 0)

    const pill = page.getByRole('link', { name: /top up|out of credits/i })
    await expect(pill).toBeVisible({ timeout: 20_000 })
    await expect(pill, 'zero reads exactly like any other number').toContainText(/out of credits/i)

    // The whole point of the pill: the address is prefilled, because the purchase
    // page reads `?key=` and any other parameter lands the payer on a blank form.
    await expect(pill).toHaveAttribute('href', `https://o.openonion.ai/purchase?key=${AGENT_ADDRESS}`)

    await shot('empty')
  })
})

test.describe('inside a conversation', () => {
  test('a low balance warns before the credits run out', async ({ page, shot }) => {
    await mockAgent(page, 'reply', { balance_usd: LOW })
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // The transcript can be scrolled away from, so the warning has to live with
    // the composer — the part that is always on screen.
    const warning = page.getByRole('link', { name: /add credits|top up/i }).last()
    await expect(warning, 'a conversation gives no sign the credits are nearly gone').toBeVisible()
    await expect(warning).toHaveAttribute('href', /purchase\?key=/)

    await shot('low')
  })

  test('a healthy balance does not nag', async ({ page }) => {
    await mockAgent(page, 'reply', { balance_usd: 12 })
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    // A balance nobody needs to act on is clutter. The warning earns its place by
    // being absent most of the time.
    await expect(page.getByText(/running low/i)).toHaveCount(0)
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the warning fits, and the way to pay is tappable', async ({ page, shot }) => {
    await mockAgent(page, 'reply', { balance_usd: LOW })
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

    const link = page.getByRole('link', { name: /add credits|top up/i }).last()
    await expect(link).toBeInViewport()

    const box = await link.boundingBox()
    expect(Math.min(box!.width, box!.height), `the link is ${box!.width}x${box!.height}`).toBeGreaterThanOrEqual(24)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'the warning pushes the page sideways').toBeLessThanOrEqual(0)

    await shot('warning')
  })
})

test.describe('a balance that changes while you watch', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  /** Reply, then republish the profile as credit is spent, then after a top-up. */
  async function drain(page: import('@playwright/test').Page) {
    await mockAgent(page, 'balance-drains')
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(pane(page).getByText('Working on it.')).toBeVisible({ timeout: 20_000 })
  }

  test('the warning arrives when the credit does not last the run', async ({ page, shot }) => {
    await drain(page)

    // The number shown on arrival is already stale by the time it matters. #85
    // put this warning in front of the composer so a run cannot quietly stop for
    // want of credit — which only works if it tracks the balance rather than
    // reading it once at mount.
    await expect(pane(page).getByText(/running low/i)).toHaveCount(0)
    await expect(
      pane(page).getByText(/running low — \$0\.35 left/i),
      'the balance fell below the threshold and nothing said so',
    ).toBeVisible({ timeout: 15_000 })

    await shot('drained')
  })

  test('and it clears once the credit is back', async ({ page }) => {
    await drain(page)
    await expect(pane(page).getByText(/running low/i)).toBeVisible({ timeout: 15_000 })

    // A warning that outlives what it warns about teaches the reader to ignore
    // the next one.
    await expect(pane(page).getByText(/running low/i)).toHaveCount(0, { timeout: 15_000 })
  })

  test('the live figure outranks the one fetched at page load', async ({ page }) => {
    await drain(page)

    // The directory still says $4.20 — it was fetched over HTTP before any of
    // this happened. Reading that in preference to the socket's profile would
    // show a comfortable balance while the agent runs dry, and it is the kind of
    // swap a refactor makes for a plausible-sounding reason.
    await expect(pane(page).getByText(/\$0\.35 left/)).toBeVisible({ timeout: 15_000 })
    await expect(pane(page).getByText(/\$4\.20 left/)).toHaveCount(0)
  })
})
