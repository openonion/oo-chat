import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Work Room initial focus styling', () => {
  it('keeps semantic heading focus without presenting it as a control', () => {
    const root = process.cwd()
    const workroom = readFileSync(
      join(root, 'components/chat/messages/coding-agent-workroom.tsx'),
      'utf8',
    )
    const styles = readFileSync(join(root, 'app/globals.css'), 'utf8')

    expect(workroom).toContain('id="workroom-heading"')
    expect(workroom).toContain('tabIndex={-1}')
    expect(styles).toMatch(
      /#workroom-heading:focus-visible\s*\{\s*outline:\s*none;\s*\}/,
    )
    expect(styles).toMatch(
      /:focus-visible\s*\{\s*outline:\s*2px solid var\(--color-neutral-900\)/,
    )
  })
})
