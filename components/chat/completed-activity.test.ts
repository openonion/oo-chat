import { describe, expect, it } from 'vitest'
import { completedActivityGroups } from './completed-activity'
import type { UI, ToolCallUI } from './types'

const tool = (id: string, status: ToolCallUI['status'] = 'done'): ToolCallUI => ({
  type: 'tool_call', id, name: 'bash', args: { command: 'npm test' }, status,
})
const reply: UI = { type: 'agent', id: 'reply', content: 'Tests passed.' }

describe('finished activity disclosure', () => {
  it('preserves all successful steps behind one disclosure once a reply arrives', () => {
    const steps = [tool('read'), tool('build'), tool('test')]
    const result = completedActivityGroups([...steps, reply])
    expect(result.groups.get('read')).toEqual(steps)
    expect([...result.hidden]).toEqual(['build', 'test'])
    expect(result.hidden.has(reply.id)).toBe(false)
  })

  it('keeps steps visible while there is no assistant result', () => {
    expect(completedActivityGroups([tool('read'), tool('build'), tool('test')]).groups.size).toBe(0)
  })

  it.each(['running', 'error'] as const)('never hides %s work even when the assistant replies', status => {
    const important = tool('needs-attention', status)
    const result = completedActivityGroups([tool('read'), important, tool('build'), tool('test'), reply])
    expect(result.groups.size).toBe(0)
    expect(result.hidden.has(important.id)).toBe(false)
  })
})
