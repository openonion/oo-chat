/**
 * Components that no page can render.
 *
 * Ultra work mode shipped with 541 lines a user cannot reach: `ModeSwitcher` is
 * the only thing that calls `onModeChange('ulw')` and nothing renders it, and
 * `UlwSetupPanel`'s gate needs four props no page supplies (openonion/oo-chat#83).
 *
 * TypeScript is happy with all of that — optional props that are never passed
 * are valid, and an exported-but-unused component is valid. The tsc and lint
 * steps added in #81 cannot see this class of gap; only asking "does anything
 * render this?" finds it.
 *
 * Source-level on purpose: a component nobody renders has no rendered fact to
 * measure. This is the one question the browser cannot answer.
 */

import { test, expect } from './fixtures'

/** Components known to be unreachable, with the issue that decides their fate.
 *  Removing an entry here is how you prove a wiring bug is fixed. */
const KNOWN_UNREACHABLE = new Set([
  'ModeSwitcher',      // #83
  'UlwToggle',         // #83 — only UlwToggleWrapper renders it, in the same file
  'UlwToggleWrapper',  // #83
])

// What this check does NOT catch, and #83 is the proof: `UlwSetupPanel`,
// `UlwMonitorPanel` and `UlwFullscreen` all appear as JSX inside `Chat`, so they
// pass here — yet no page supplies the props their render is gated on, which
// makes them unreachable at runtime anyway. "Rendered somewhere in the source"
// is the weaker property; it is simply the one a grep can decide. Runtime
// reachability still needs a spec that drives the UI to the state.

test('every exported chat component is rendered by something', async () => {
  const { execSync } = await import('node:child_process')

  const exported = execSync(
    `grep -ohE "^export \\{ [A-Za-z, ]+ \\}" components/chat/index.ts || true`,
    { encoding: 'utf8' }
  )
    .replace(/export \{|\}/g, '')
    .split(/[,\n]/)
    .map(s => s.trim())
    .filter(s => /^[A-Z]/.test(s))

  expect(exported.length, 'the chat barrel exports nothing — did it move?').toBeGreaterThan(5)

  const orphans = exported.filter(name => {
    // Anything that renders it as JSX, excluding its own definition and the barrel.
    const hits = execSync(
      // `<Chat` is followed by a newline when the props are on their own lines,
      // so the character class has to allow end-of-line. My first pattern did not,
      // and reported Chat, ChatMessages and ModeStatusBar as unreachable — all of
      // which I had just watched render.
      // Excludes the barrel, and the module that defines the component: UlwToggle
      // is rendered only by UlwToggleWrapper, which lives in the same file and is
      // itself rendered nowhere. A pair that only renders each other is still a
      // pair nothing reaches, so "something OUTSIDE its own module renders it" is
      // the question worth asking.
      `grep -rlE "<${name}([ />]|$)" app components 2>/dev/null` +
      ` | grep -v "components/chat/index.ts"` +
      ` | xargs -I{} sh -c 'grep -q "export function ${name}\\b" {} || echo {}' || true`,
      { encoding: 'utf8' }
    ).split('\n').filter(Boolean)
    return hits.length === 0
  })

  const unexpected = orphans.filter(n => !KNOWN_UNREACHABLE.has(n))
  expect(
    unexpected,
    'exported but rendered nowhere — either wire it up or delete it'
  ).toEqual([])

  // And the list has to stay honest: a name that became reachable should come
  // off it, or the guard slowly turns into a permanent excuse.
  const stale = [...KNOWN_UNREACHABLE].filter(n => !orphans.includes(n))
  expect(stale, 'these are reachable now — remove them from KNOWN_UNREACHABLE').toEqual([])
})
