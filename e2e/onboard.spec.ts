/**
 * The payment branch of the invite gate.
 *
 * It had never been rendered by a test, and it was unreachable in practice —
 * both gated agents in use accept invite codes only. That is how it drifted far
 * enough to show "Pay $12.00 to start" beside a credit-card icon while charging
 * nothing and showing no payee, and how the SDK came to drop `payment_address`
 * on the floor without anyone noticing.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PAYEE_ADDRESS, PROFILE } from './mock-agent'

test.describe('a gate that asks for payment', () => {
  test('says where to send it, and does not claim to charge', async ({ page, shot }) => {
    await mockAgent(page, 'onboard-payment')
    await page.goto(`/${AGENT_ADDRESS}`)

    const gate = page.getByText(new RegExp(`${PROFILE.name} is invite-only`))
    await expect(gate).toBeVisible({ timeout: 20_000 })

    // The amount, and the address it goes to. Without the payee this branch asks
    // for money and gives the reader nowhere to send it.
    await expect(page.getByText(/\$12\.00/)).toBeVisible()
    // The payee itself, by value: a copy button proves a control exists, not that
    // it carries the address the host actually published.
    await expect(page.getByTitle(PAYEE_ADDRESS)).toBeVisible()

    // Nothing may read as an in-app checkout: submitting only signs an assertion
    // that a payment happened, which the agent then decides whether to believe.
    await expect(page.getByRole('button', { name: /^pay .* to start$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /sent it/i })).toBeVisible()

    await shot('gate')
  })

  test('the invite code path still works alongside it', async ({ page }) => {
    await mockAgent(page, 'onboard-payment')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByText(new RegExp(`${PROFILE.name} is invite-only`))).toBeVisible({ timeout: 20_000 })

    // Payment is the second option, never a replacement — an agent offering both
    // must not lose the one that actually works today.
    await expect(page.getByRole('textbox').first()).toBeVisible()
  })
})

test.describe('phone', () => {
  // An iPhone SE — the shortest screen still in real use.
  test.use({ viewport: { width: 375, height: 667 } })

  test('the code field and its submit are usable', async ({ page, shot }) => {
    await mockAgent(page, 'onboard-payment')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 })

    const field = page.getByRole('textbox').first()
    await field.fill('DEMO-1234')

    // 16px or larger, or iOS zooms the page on focus and leaves the reader in a
    // viewport they then have to pinch back out of.
    const size = await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    expect(size, `the code field is ${size}px, so iOS will zoom on focus`).toBeGreaterThanOrEqual(16)

    const submit = page.getByRole('button', { name: /continue/i }).first()
    const box = await submit.boundingBox()
    expect(box!.height, `submit is ${box!.height}px tall`).toBeGreaterThanOrEqual(40)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'the gate pushes the page sideways').toBeLessThanOrEqual(0)

    await shot('code')
  })

  test('the payee address can be reached — it is the whole point of this branch', async ({ page, shot }) => {
    await mockAgent(page, 'onboard-payment')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 })

    const copy = page.getByRole('button', { name: /copy agent address/i }).last()
    await copy.scrollIntoViewIfNeeded()
    await expect(copy).toBeInViewport()

    await shot('payment')
  })
})

test.describe('phone, keyboard open', () => {
  // Tapping the code field is the first thing anyone does here, and on an SE the
  // keyboard leaves roughly this much visual viewport. The gate is taller than
  // that, which is the case plain centring gets wrong.
  test.use({ viewport: { width: 375, height: 360 } })

  test('the top of the gate is still reachable', async ({ page, shot }) => {
    await mockAgent(page, 'onboard-payment')
    await page.goto(`/${AGENT_ADDRESS}`)

    const panel = page.getByRole('dialog')
    await expect(panel).toBeVisible({ timeout: 20_000 })

    // Measured on the unfixed code: top = -65 with scrollTop already 0, and
    // setting scrollTop = 0 changed nothing — the overflow is above the scroll
    // origin, so those 65px are not merely off-screen, they are unreachable.
    const before = await panel.evaluate(el => {
      el.parentElement!.scrollTop = 0
      return el.getBoundingClientRect().top
    })
    expect(before, `the top of the gate sits at ${Math.round(before)}px and cannot be scrolled to`).toBeGreaterThanOrEqual(0)

    // The two things living up there: whose gate this is, and why there is one.
    await expect(page.locator('#onboard-gate-title')).toBeInViewport()

    // And the rest must still be reachable by scrolling, or the fix has only
    // moved the unreachable part to the other end.
    const copy = page.getByRole('button', { name: /copy agent address/i }).last()
    await copy.scrollIntoViewIfNeeded()
    await expect(copy).toBeInViewport()

    await shot('keyboard')
  })
})
