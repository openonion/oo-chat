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
    await expect(page.getByRole('button', { name: /copy agent address/i }).last()).toBeVisible()

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
