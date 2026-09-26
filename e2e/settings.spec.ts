/**
 * Settings, where an agent's balance lives and where its address is copied from.
 *
 * The agent row is the part that had never been looked at on a phone. In one
 * horizontal row the fixed parts left about 96px for the agent itself, so the
 * address rendered as "0…" and the tool chips stacked one per line into a tall
 * column — the row was legible on a laptop and nonsense on the device most
 * people open it on.
 */

import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** Settings only lists agents the browser has already talked to. */
async function settingsWithAnAgent(page: import('@playwright/test').Page) {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: /agents/i }).first()).toBeVisible()
}

test.describe('phone', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('the agent row shows a real address and lays its tools out sideways', async ({ page, shot }) => {
    await settingsWithAnAgent(page)

    const address = page.locator('main').getByText(AGENT_ADDRESS, { exact: true }).first()
    await expect(address).toBeVisible()

    // "0…" is what the squeezed column produced. Anything under a third of the
    // width means the row has collapsed again.
    const box = await address.boundingBox()
    expect(box!.width, 'the address collapsed — the row is being squeezed').toBeGreaterThan(120)

    // Tool chips belong on a line, not in a column: with six of them stacking, the
    // row grew past the height of the phone.
    const chips = page.getByText('read_file', { exact: true }).first()
    if (await chips.count()) {
      const first = await page.getByText('bash', { exact: true }).first().boundingBox()
      const second = await chips.boundingBox()
      expect(second!.y, 'tool chips are stacking one per line').toBeLessThan(first!.y + first!.height)
    }

    await shot('agents')
  })

  test('balance and top-up are reachable here too, at a tappable size', async ({ page }) => {
    await settingsWithAnAgent(page)

    const topUp = page.getByRole('link', { name: /top up/i })
    await expect(topUp).toHaveAttribute('href', `https://o.openonion.ai/purchase?key=${AGENT_ADDRESS}`)
    await expect(page.getByText(`$${PROFILE.balance_usd.toFixed(2)}`)).toBeVisible()

    const box = await topUp.boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(24)
  })

  test('every control is big enough to hit, and nothing scrolls sideways', async ({ page }) => {
    await settingsWithAnAgent(page)

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow, 'settings scrolls sideways on a phone').toBeLessThanOrEqual(0)

    const small: string[] = []
    for (const el of await page.locator('button:visible, a:visible').all()) {
      const box = await el.boundingBox()
      if (!box) continue
      if (box.width < 24 || box.height < 24) {
        const label = (await el.getAttribute('aria-label')) || (await el.innerText())
        small.push(`${label.replace(/\s+/g, ' ').trim().slice(0, 30)} — ${Math.round(box.width)}x${Math.round(box.height)}`)
      }
    }
    expect(small, 'targets below the 24px floor').toEqual([])
  })

  test('the remove dialog keeps keyboard focus until it closes', async ({ page }) => {
    await settingsWithAnAgent(page)
    const trigger = page.locator('main').getByRole('button', { name: 'Remove agent' }).first()
    await trigger.click()
    const dialog = page.getByRole('alertdialog', { name: 'Remove this agent?' })
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: 'Remove' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })
})

test.describe('narrow phone', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test('the add form stays inside the card', async ({ page }) => {
    await page.goto('/settings')
    const input = page.getByRole('textbox', { name: 'Agent address' })
    await input.scrollIntoViewIfNeeded()
    const field = await input.boundingBox()
    const add = await page.getByRole('button', { name: 'Add', exact: true }).boundingBox()
    expect(field!.width).toBeGreaterThan(120)
    expect(add!.x + add!.width).toBeLessThanOrEqual(320)
  })

  test('the recovery phrase can be read and dismissed on a short screen', async ({ page }) => {
    page.on('dialog', dialog => dialog.accept())
    await page.goto('/settings')
    await page.getByRole('button', { name: 'Create new identity', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Secure Your Recovery Phrase' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: 'Secure Your Recovery Phrase' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: 'Copy Phrase' })).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(dialog.getByRole('button', { name: "I've Stored It Safely" })).toBeFocused()
    expect(await dialog.evaluate(el => el.scrollHeight)).toBeGreaterThan(await dialog.evaluate(el => el.clientHeight))

    const action = dialog.getByRole('button', { name: "I've Stored It Safely" })
    await action.scrollIntoViewIfNeeded()
    const box = await action.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(0)
    expect(box!.y + box!.height).toBeLessThanOrEqual(568)
    await action.click()
    await expect(dialog).toHaveCount(0)
  })
})

test.describe('desktop', () => {
  test('the agent row is still one line', async ({ page, shot }) => {
    await settingsWithAnAgent(page)

    // The stacking is a phone concession; on a laptop the balance still sits at
    // the end of the agent's own row rather than under it.
    // Scoped to main: the sidebar lists the same agent, 547px up the page.
    const name = await page.locator('main').getByText(PROFILE.name).first().boundingBox()
    const topUp = await page.getByRole('link', { name: /top up/i }).boundingBox()
    expect(topUp!.x, 'top-up dropped below the agent instead of beside it').toBeGreaterThan(name!.x)
    expect(Math.abs(topUp!.y - name!.y), 'top-up is on a different line').toBeLessThan(80)

    await shot('agents')
  })
})
