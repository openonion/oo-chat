/**
 * The end-to-end pass: land on an agent, send a message, get a reply, and
 * photograph every state on the way through — desktop and phone.
 *
 * Screenshots are the deliverable as much as the assertions. A green run that
 * nobody looks at cannot catch "the button is now white on white"; the workflow
 * uploads these and links them from the pull request so a human sees the change.
 */

import { test, expect, type Page } from '@playwright/test'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'
import { shot } from './shot'

/** The app mints a BIP39 identity on first paint. Seeding one keeps the recovery
 *  phrase out of the screenshots and stops a fresh key being generated per test. */
async function seedIdentity(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'oo-chat-storage',
      JSON.stringify({ state: { conversations: [], agents: [] }, version: 0 })
    )
  })
}

async function landing(page: Page, scenario: Parameters<typeof mockAgent>[1] = 'reply') {
  await seedIdentity(page)
  await mockAgent(page, scenario)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
}

test.describe('agent landing page', () => {
  test('shows who the agent is, its address, and how to pay it', async ({ page }, info) => {
    await landing(page)

    await expect(page.getByText('online')).toBeVisible()
    await expect(page.getByText(PROFILE.model)).toBeVisible()

    // The address is the agent's only durable name and the target of a top-up.
    await expect(page.getByRole('button', { name: /copy agent address/i })).toBeVisible()

    // Published balance means the address resolves, so the top-up must be offered.
    const topUp = page.getByRole('link', { name: /top up/i })
    await expect(topUp).toHaveAttribute(
      'href',
      `https://o.openonion.ai/purchase?key=${AGENT_ADDRESS}`
    )

    await shot(page, info, 'landing')
  })

  test('the header survives expanding the inventory', async ({ page }, info) => {
    await landing(page)
    const disclosure = page.getByRole('button', { name: /tools|skills/i }).first()
    if (await disclosure.isVisible().catch(() => false)) await disclosure.click()

    // Regression for the centred-scroller bug: growing the column used to push the
    // identity off the top of a scroll container that could not scroll back up.
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeInViewport()
    await shot(page, info, 'landing-expanded')
  })
})

test.describe('a full exchange', () => {
  test('send a message and get the reply rendered', async ({ page }, info) => {
    await landing(page)

    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page).toHaveURL(new RegExp(`${AGENT_ADDRESS}/.+`))

    await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 15_000 })
    await shot(page, info, 'reply')
  })

  test('a tool call renders as a card and reports its result', async ({ page }, info) => {
    await landing(page, 'tools')
    await page.getByRole('button', { name: 'What can you do?' }).click()

    // Collapsed, the row states the tool and what it was for; the command itself
    // is behind the disclosure. Both halves matter — the collapsed line is what a
    // reader skims, the expanded one is what they audit.
    await expect(page.getByText('check the kernel')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Darwin 23\.1\.0/)).toBeVisible()

    await page.getByText('check the kernel').click()
    await expect(page.getByText('uname -a')).toBeVisible()
    await shot(page, info, 'tool-card')
  })

  test('an approval prompt blocks the run and offers all four answers', async ({ page }, info) => {
    await landing(page, 'approval')
    await page.getByRole('button', { name: 'What can you do?' }).click()

    await expect(page.getByRole('button', { name: /allow once/i })).toBeVisible({ timeout: 15_000 })
    // Each qualifier has to be readable, not just present — this row is the only
    // thing separating "reject one call" from "kill the whole run".
    for (const label of [/trust/i, /reject/i, /stop/i, /explain/i]) {
      await expect(page.getByRole('button', { name: label })).toBeVisible()
    }
    await shot(page, info, 'approval')
  })

  test('an agent error is surfaced, not swallowed', async ({ page }, info) => {
    await landing(page, 'error')
    await page.getByRole('button', { name: 'What can you do?' }).click()

    await expect(page.getByRole('alert').filter({ hasText: /credits/i })).toBeVisible({ timeout: 15_000 })
    await shot(page, info, 'error')
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('nothing overflows the viewport at 375px', async ({ page }, info) => {
    await landing(page, 'approval')
    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByRole('button', { name: /allow once/i })).toBeVisible({ timeout: 15_000 })

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'page scrolls sideways on a phone').toBeLessThanOrEqual(0)
    await shot(page, info, 'phone-approval')
  })

  test('the closed drawer is not reachable by keyboard', async ({ page }, info) => {
    await landing(page)
    // Regression for the off-screen sidebar: it used to stay in the tab order, so
    // Remove agent and Delete chat were activatable while invisible.
    const hidden = await page.locator('aside').evaluate(el => getComputedStyle(el).visibility)
    expect(hidden).toBe('hidden')
    await shot(page, info, 'phone-landing')
  })
})

test.describe('the other surfaces', () => {
  test('agent picker', async ({ page }, info) => {
    await seedIdentity(page)
    await page.goto('/')
    await expect(page.getByText(/talk to any agent/i)).toBeVisible()
    await shot(page, info, 'home')
  })

  test('settings', async ({ page }, info) => {
    await seedIdentity(page)
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
    await shot(page, info, 'settings')
  })
})
