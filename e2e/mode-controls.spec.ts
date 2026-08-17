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
    // Permission and the local Plan workflow stay visibly separate. The
    // permission menu is small enough not to bury the distinction in a wall of
    // mixed controls.
    const trigger = page.getByRole('button', { name: 'Permission: Read only', exact: true })
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
    const plan = page.getByRole('button', { name: 'Plan: Off', exact: true })
    const planBox = await plan.boundingBox()
    expect(planBox).not.toBeNull()
    expect(planBox!.height).toBeGreaterThanOrEqual(44)
    expect(planBox!.width).toBeGreaterThanOrEqual(44)

    const menu = page.getByRole('menu', { name: 'Host permission' })
    await expect(menu).toBeVisible()

    for (const label of [/^Read only$/, /^Auto$/, /^Full access$/]) {
      const item = menu.getByRole('menuitemradio', { name: label })
      const box = await item.boundingBox()
      expect(box, `${label} should be visible`).not.toBeNull()
      expect(box!.height, `${label} should be at least 44px tall`).toBeGreaterThanOrEqual(44)
      expect(box!.width, `${label} should be at least 44px wide`).toBeGreaterThanOrEqual(44)
    }
  })
}

test('the permission menu remains reachable above a multiline draft on a narrow phone', async ({ page, shot }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 320, height: 640 })
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)

  // The landing composer says “Message this agent…” before the first turn and
  // “Send a message…” afterwards. Its textarea is the stable contract here.
  const draft = page.locator('textarea').first()
  await expect(draft).toBeVisible({ timeout: 90_000 })
  await draft.fill([
    'Keep this draft while choosing permission.',
    'It has enough lines to exercise the resized composer.',
    'The menu must remain reachable and inside the safe viewport.',
    'No hidden overlay may cover this text.',
  ].join('\n'))
  await expect.poll(async () => (await draft.boundingBox())?.height ?? 0).toBeGreaterThan(44)

  const trigger = page.getByRole('button', { name: 'Permission: Read only', exact: true })
  await trigger.click()
  const menu = page.getByRole('menu', { name: 'Host permission' })
  await expect(menu).toBeVisible()

  const [menuBox, draftBox] = await Promise.all([menu.boundingBox(), draft.boundingBox()])
  expect(menuBox).not.toBeNull()
  expect(draftBox).not.toBeNull()
  expect(menuBox!.y).toBeGreaterThanOrEqual(0)
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(640)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
    'narrow multiline composer scrolls sideways',
  ).toBeLessThanOrEqual(0)
  await shot('mode-controls-multiline-phone')
})
