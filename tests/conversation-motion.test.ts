import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The conversation's motion (oo-chat#278, PR 2) must keep every state change under
// reduced motion but move nothing: opacity only. This reads the stylesheet itself,
// since the rules live in plain CSS.
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8')
const section = css.slice(css.indexOf('/* ---- Conversation motion'))
const reduced = section.slice(section.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
const keyframes = (name: string) => section.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? ''

describe('conversation motion', () => {
  it('animates only blur and opacity on streaming words, so nothing changes size', () => {
    expect(keyframes('stream-word-in')).not.toMatch(/transform|width|height|margin|padding/)
  })

  it('turns every conversation animation into opacity only under reduced motion', () => {
    expect(reduced).toMatch(/html \.stream-word\.is-fresh \{ animation: motion-fade-in/)
    expect(reduced).toMatch(/html \.status-wave > span \{ animation-name: status-wave-fade/)
    expect(reduced).toMatch(/transform: none !important/)
    for (const name of ['motion-fade-in', 'status-wave-fade']) {
      const body = keyframes(name)
      expect(body).toMatch(/opacity/)
      expect(body).not.toMatch(/transform|filter|translate/)
    }
  })

  it('names the properties it transitions', () => {
    expect(section).not.toMatch(/transition:\s*all|transition-property:\s*all/)
  })
})
