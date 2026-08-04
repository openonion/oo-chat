/**
 * Controls whose spoken name contains the word printed on them.
 *
 * WCAG 2.5.3. A speech-input user says "click Share"; if the accessible name is
 * "Show QR code" the command matches nothing and nothing explains why. It is
 * also the failure that hides a control from `getByRole` — which is how this was
 * found: a probe looked for a button named Share, found none, and the button was
 * sitting there in plain sight.
 *
 * Enumerated across the surfaces rather than asserted on the one control that
 * was wrong, because the next `aria-label` someone adds to a labelled button is
 * the one this needs to catch.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** Controls whose aria-label omits their own visible text. */
function mismatches(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const out: string[] = []
    for (const el of document.querySelectorAll('button, a')) {
      const label = el.getAttribute('aria-label')
      if (!label) continue
      const text = (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
      // Icon-only controls have no visible text and are exactly what aria-label
      // is for; only a control that prints a word must repeat that word.
      if (!text) continue
      if (!label.toLowerCase().includes(text.toLowerCase())) {
        out.push(`"${text}" is announced as "${label}"`)
      }
    }
    return [...new Set(out)]
  })
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('every labelled control says its own word', async ({ page }) => {
    await mockAgent(page, 'busy')
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })
    expect(await mismatches(page), 'on the landing page').toEqual([])

    await page.getByRole('button', { name: 'What can you do?' }).click()
    await expect(page.getByText(/rebuilt the site|Read the page/i).first()).toBeVisible({ timeout: 20_000 })
    expect(await mismatches(page), 'in a conversation').toEqual([])

    await page.getByRole('button', { name: /menu/i }).first().click()
    await expect(page.locator('aside')).toHaveCSS('visibility', 'visible')
    expect(await mismatches(page), 'in the drawer').toEqual([])

    await page.goto('/settings')
    await expect(page.getByPlaceholder(/paste agent address/i)).toBeVisible({ timeout: 20_000 })
    expect(await mismatches(page), 'in settings').toEqual([])
  })

  test('the share control can be reached by its own name', async ({ page, shot }) => {
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible({ timeout: 20_000 })

    // The concrete case: this is what a screen reader or a speech command has to
    // be able to find, and what `getByRole` could not.
    const share = page.getByRole('button', { name: /share/i })
    await expect(share, 'the button reading "Share" cannot be found by that name').toBeVisible()

    await share.click()

    // A modal that is not a dialog changes nothing a screen reader perceives:
    // the content is appended, focus stays on the button behind it, and Tab
    // carries on through the page underneath. The invite gate already does this
    // properly; this one did not.
    const modal = page.getByRole('dialog')
    await expect(modal, 'the share modal is not announced as one').toBeVisible()
    await expect(modal).toContainText(/scan to open/i)

    // Focus has to move in, or a keyboard reader is still outside it.
    await expect(page.getByRole('button', { name: /^close$/i })).toBeFocused()

    await shot('qr')

    // And Escape gets out, unlike the invite gate — dismissing this leaves a
    // usable page, so refusing to close would be the wrong answer.
    await page.keyboard.press('Escape')
    await expect(modal).toHaveCount(0)
    await expect(share, 'focus was dropped instead of returned').toBeFocused()
  })
})
