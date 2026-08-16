/**
 * The drawer, control by control.
 *
 * The existing coverage checks two specific controls — New chat and Remove agent —
 * inside the agent action menu. Everything else in there had never been measured, and
 * three things were wrong: the close button, which on a phone is the drawer's only
 * labelled way out, announced as "button" with no name at all; Delete chat was a
 * 20px destructive target under the app's own 24px floor; and that same delete
 * button sat *inside* the session's `<Link>`, which is invalid HTML and resolves
 * ambiguously — the same defect AgentAddress was already fixed for.
 *
 * Enumerating every control rather than naming them one at a time, because the
 * ones nobody thought to name are exactly the ones that were broken.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** A drawer with an agent and one session in it — the state with the most controls. */
async function openDrawer(page: import('@playwright/test').Page) {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'What can you do?' }).click()
  await expect(page.getByText('You said: What can you do?')).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /menu/i }).first().click()
  const drawer = page.locator('aside')
  await expect(drawer).toHaveCSS('visibility', 'visible')
  return drawer
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('every control in the drawer has a name', async ({ page, shot }) => {
    const drawer = await openDrawer(page)

    // An icon-only control with no text and no aria-label is announced as
    // "button" — the reader is told a control exists and nothing about it.
    const unnamed = await drawer.locator('a:visible, button:visible').evaluateAll(els =>
      els
        .filter(el => {
          const name = (el as HTMLElement).innerText.trim()
            || el.getAttribute('aria-label')
            || el.getAttribute('title')
          return !name
        })
        .map(el => `${el.tagName} ${el.className.toString().slice(0, 60)}`)
    )
    expect(unnamed, 'these announce as bare "button" / "link"').toEqual([])

    await shot('drawer')
  })

  test('every control clears the touch floor', async ({ page }) => {
    const drawer = await openDrawer(page)

    const small: string[] = []
    for (const el of await drawer.locator('a:visible, button:visible').all()) {
      const box = await el.boundingBox()
      if (!box) continue
      if (box.width < 24 || box.height < 24) {
        const name = (await el.getAttribute('aria-label')) || (await el.innerText())
        small.push(`${name.replace(/\s+/g, ' ').trim().slice(0, 24)} — ${Math.round(box.width)}x${Math.round(box.height)}`)
      }
    }
    // Delete chat was 20x20. It is the one control here that destroys something,
    // and it was the smallest thing in the drawer.
    expect(small, 'targets below the 24px floor').toEqual([])
  })

  test('deleting a chat is not nested inside opening it', async ({ page }) => {
    const drawer = await openDrawer(page)

    const del = drawer.getByRole('button', { name: /delete chat/i }).first()
    await expect(del).toBeVisible()

    // A button inside an anchor is invalid HTML and assistive technology resolves
    // the pair ambiguously — the outer control ends up announcing the inner one's
    // label as part of its own name. Doing it with a destructive control inside a
    // navigation link is the worst version: the two things a thumb can land on are
    // "open this chat" and "delete it".
    const nested = await del.evaluate(el => Boolean(el.closest('a')))
    expect(nested, 'the delete button is inside the session link').toBe(false)
  })

  test('delete asks first, and the chat survives a cancel', async ({ page, shot }) => {
    const drawer = await openDrawer(page)

    await drawer.getByRole('button', { name: /delete chat/i }).first().click()

    // Destroying a conversation is confirmed, not immediate.
    const cancel = page.getByRole('button', { name: /cancel/i }).first()
    await expect(cancel).toBeVisible()
    await shot('confirm')

    await cancel.click()
    await expect(page.getByRole('link', { name: /what can you do/i }).first()).toBeVisible()
  })
})
