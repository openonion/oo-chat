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
