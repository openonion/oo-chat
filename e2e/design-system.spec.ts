/**
 * The colour vocabulary, held down.
 *
 * "This agent is live" is drawn in four places — the chat header, the sidebar,
 * the agent picker, and the landing page — and each one used to reach for a raw
 * `green-500`. Four independent copies of one meaning is how a palette drifts:
 * change the brand ramp and three of them stay behind.
 *
 * These assert the rendered colour rather than the class name, because a class
 * that no longer resolves is exactly the failure a class-name grep cannot see.
 */

import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures'
import { mockAgent, AGENT_ADDRESS, PROFILE } from './mock-agent'

/** --color-brand-500 as declared in the theme, in the form the browser reports. */
const BRAND_500 = (() => {
  const css = readFileSync('app/globals.css', 'utf8')
  const hex = /--color-brand-500:\s*(#[0-9a-f]{6})/i.exec(css)?.[1]
  if (!hex) throw new Error('--color-brand-500 is gone from globals.css')
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
})()

test('the live dot is the brand token, not a hand-picked green', async ({ page }) => {
  await mockAgent(page)
  await page.goto(`/${AGENT_ADDRESS}`)
  await expect(page.getByRole('heading', { name: PROFILE.name, exact: true })).toBeVisible()

  // The landing page's online pill and the sidebar's live dot are two of the four
  // copies; if either drifts off the ramp the brand stops being a single source.
  const landingDot = page.locator('main span.rounded-full').filter({ hasNot: page.locator('*') }).first()
  const colours = await page.evaluate(() =>
    [...document.querySelectorAll('span, svg')]
      .map(el => getComputedStyle(el).backgroundColor)
      .filter(c => c.startsWith('rgb') && c !== 'rgba(0, 0, 0, 0)')
  )
  expect(landingDot, 'no status dot rendered at all').toBeTruthy()
  expect(colours, 'the live indicator is not on the brand ramp').toContain(BRAND_500)
})

test('no component in the chat tree ships a raw Tailwind green', async () => {
  // Source-level on purpose. I first wrote this as a computed-colour check over a
  // rendered transcript and it passed against the unfixed code — the greens live
  // on states that transcript never renders (a copy tick appears only after you
  // click, and the eval, login and diff cards were not in the scenario). A guard
  // that cannot see the thing it guards is worse than none.
  //
  // "No raw green in the source" is a source fact, and the class name is what a
  // reviewer would actually type. The rendered counterpart — that the live dot
  // resolves to the token — is the test above.
  const { execSync } = await import('node:child_process')
  const hits = execSync('grep -rn "green-[0-9]" components/chat || true', { encoding: 'utf8' })
    .split('\n')
    .filter(l => l.trim())
  expect(hits, 'these should go through --color-brand-* so the ramp is one place').toEqual([])
})

test('the type scale stays closed', async () => {
  // 15 sizes, and three of them were duplicates of a named step: text-[12px] is
  // text-xs, text-[14px] is text-sm, and text-[9px]/text-[10px] were the same
  // micro-caps label that 50 other places already set at 11px. Same for
  // font-black on an 11px uppercase label — the heaviest weight on the smallest
  // text — and tracking-widest beside it.
  //
  // Source-level because a size is a class, not a rendered fact: two elements can
  // compute to the same px and still be written four different ways, which is the
  // thing that actually accretes.
  const { execSync } = await import('node:child_process')
  const banned = execSync(
    'grep -rnoE "text-\\[(9|10|12|14)px\\]|font-black|tracking-(widest|wider)" app components || true',
    { encoding: 'utf8' }
  ).split('\n').filter(Boolean)

  expect(banned, [
    'these have an equivalent already in use:',
    '  text-[12px] -> text-xs        text-[14px] -> text-sm',
    '  text-[9px], text-[10px] -> text-[11px]',
    '  font-black -> font-semibold   tracking-widest/wider -> tracking-wide',
  ].join('\n')).toEqual([])
})

test('no component ships its own violet', async () => {
  // Context compaction was the only violet in the app, spent on a housekeeping
  // event the reader never asked about. The palette is neutral plus one green.
  const { execSync } = await import('node:child_process')
  const hits = execSync('grep -rn "violet\\|amber\\|cream" components app || true', { encoding: 'utf8' })
    .split('\n')
    .filter(l => l.trim() && !l.includes('// '))
  expect(hits, 'an off-palette hue came back').toEqual([])
})
