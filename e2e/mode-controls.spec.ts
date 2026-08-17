import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS } from './mock-agent'

for (const viewport of [
  { name: 'phone', width: 375, height: 667 },
  { name: 'desktop', width: 1280, height: 900 },
]) {
  test(`mode controls fit and remain tappable on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await mockAgent(page)
    await page.goto(`/${AGENT_ADDRESS}`)
    // The composer has one calm current-mode control. Its menu keeps advanced
    // choices reachable without making four unrelated controls compete at rest.
    const trigger = page.getByRole('button', { name: 'Mode: Read only', exact: true })
    await expect(trigger).toBeVisible({ timeout: 90_000 })

    const metrics = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth,
    }))
    expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.innerWidth)
    expect(metrics.bodyWidth).toBeLessThanOrEqual(metrics.innerWidth)

    const triggerBox = await trigger.boundingBox()
    expect(triggerBox).not.toBeNull()
    expect(triggerBox!.height).toBeGreaterThanOrEqual(44)
    expect(triggerBox!.width).toBeGreaterThanOrEqual(44)

    await trigger.click()
    const menu = page.getByRole('menu', { name: 'Execution mode' })
    await expect(menu).toBeVisible()
    const plan = menu.getByRole('menuitemcheckbox', { name: 'Plan', exact: true })
    const planBox = await plan.boundingBox()
    expect(planBox).not.toBeNull()
    expect(planBox!.height).toBeGreaterThanOrEqual(44)
    expect(planBox!.width).toBeGreaterThanOrEqual(44)

    for (const label of [/^Read only$/, /^Auto$/, /^Full access$/]) {
      const item = menu.getByRole('menuitemradio', { name: label })
      const box = await item.boundingBox()
      expect(box, `${label} should be visible`).not.toBeNull()
      expect(box!.height, `${label} should be at least 44px tall`).toBeGreaterThanOrEqual(44)
      expect(box!.width, `${label} should be at least 44px wide`).toBeGreaterThanOrEqual(44)
    }
  })
}
