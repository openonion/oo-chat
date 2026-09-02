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

test.describe('a shared session link', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  /** Someone forwards a chat URL to a colleague who was never invited. */
  const SHARED = `/${AGENT_ADDRESS}/forwarded-session-link`

  test('gates before the reader writes anything', async ({ page, shot }) => {
    const agent = await mockAgent(page, 'onboard-payment')
    await page.goto(SHARED)

    // The landing page opens its socket eagerly, so ONBOARD_REQUIRED arrives and
    // the wall is up before anything is typed. This route did not connect at all
    // until the first send, so a gated agent looked open: a composer, the offer
    // chips, and a filled "What can you do?" inviting the reader in. They wrote a
    // real message, sent it, and only then met the gate — with their text already
    // consumed into a run that could not proceed. That is the ordering #27 fixed
    // for the landing page and left standing here.
    await expect(
      page.getByRole('dialog'),
      'a gated agent looks open when reached by a session link',
    ).toBeVisible({ timeout: 20_000 })

    await expect(page.getByText(new RegExp(`${PROFILE.name} is invite-only`))).toBeVisible()
    // One ONBOARD_REQUIRED frame used to mount both the wall and the transcript
    // card behind it. That produced two code fields and two Continue buttons in
    // the same document for one challenge.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('textbox')).toHaveCount(1)
    await expect(dialog.getByRole('button', { name: /continue/i })).toHaveCount(1)
    await expect(page.getByPlaceholder('Enter your invite code')).toHaveCount(0)

    // ONBOARD_REQUIRED is also a transcript item. The full-screen gate owns it
    // before the first user message, so rendering both creates duplicate form
    // controls even though the opaque wall visually hides one of them (#158).
    await expect(page.getByPlaceholder(/invite code/i), 'two invite fields exist for one challenge').toHaveCount(1)
    await expect(page.getByRole('button', { name: /continue/i }), 'two Continue buttons exist for one challenge').toHaveCount(1)
    await expect(page.getByText(/verification required/i)).toHaveCount(0)
    expect(agent.sent('CONNECT').some(frame => frame.session_id === 'forwarded-session-link')).toBe(false)

    await shot('single-verifier')
  })

  test('nothing behind the gate invites a message', async ({ page }) => {
    await mockAgent(page, 'onboard-payment')
    await page.goto(SHARED)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 20_000 })

    // The wall is opaque and covers the pane, so the composer and the openers
    // behind it must not be reachable — offering a way to type into an agent that
    // will refuse is the whole failure.
    await expect(page.getByRole('button', { name: 'What can you do?' })).toHaveCount(0)
  })

  test('an open agent reached the same way is not gated', async ({ page }) => {
    await mockAgent(page)
    await page.goto(SHARED)

    // Connecting eagerly must not put a wall in front of agents that take anyone.
    await expect(page.getByPlaceholder(/message/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('an agent that gates partway through', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('keeps the conversation readable behind an in-transcript prompt', async ({ page, shot }) => {
    await mockAgent(page, 'gate-midway')
    await page.goto(`/${AGENT_ADDRESS}`)
    await page.getByRole('button', { name: 'What can you do?' }).click()

    // The wall is for arriving at a closed door. Here the reader is already
    // inside, so covering their thread with an opaque panel would take away the
    // conversation they are being asked about — which is the distinction the new
    // condition draws, and the branch it would be easy to get wrong.
    await expect(page.getByText(/verification required/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('dialog'), 'the wall covered an existing conversation').toHaveCount(0)
    await expect(page.getByPlaceholder(/invite code/i), 'the inline verifier disappeared').toHaveCount(1)
    await expect(page.getByRole('button', { name: /continue/i })).toHaveCount(1)
    // Scoped to the pane: unscoped, the first match is the drawer's session title,
    // which is hidden. That has now cost four tests across these passes.
    await expect(page.locator('main').getByText('What can you do?').first()).toBeVisible()

    await shot('midway')
  })
})
