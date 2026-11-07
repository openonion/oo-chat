/** @vitest-environment jsdom */

import { act, type ComponentType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ToolCallUI } from '../../types'
import { GenericCard } from './generic-card'
import { BashCard } from './bash-card'
import { BackgroundCard } from './background-card'

vi.mock('./approval-buttons', () => ({ ApprovalButtons: () => null }))

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: Root | null = null

function renderTool(toolCall: ToolCallUI, Card: ComponentType<{ toolCall: ToolCallUI }> = GenericCard) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<Card toolCall={toolCall} />))
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('GenericCard action-summary disclosure', () => {
  it.each([['generic', GenericCard], ['bash', BashCard], ['background provider', BackgroundCard]] as const)('%s renders a user-stopped tool neutrally with elapsed time', (_, Card) => {
    const element = renderTool({
      id: 'paused-command', type: 'tool_call', name: 'bash',
      args: { command: 'sleep 90' }, status: 'stopped',
      result: 'Interrupted by user', timing_ms: 17000,
    } as ToolCallUI, Card)

    expect(element.textContent).toContain('Stopped')
    expect(element.textContent).toContain('17s')
    expect(element.textContent).not.toMatch(/running|exit [01]/)
    expect(element.querySelector('[class*="red-"]')).toBeNull()
    expect(element.querySelector('.animate-pulse')).toBeNull()
  })

  it('preserves a genuine command failure', () => {
    const element = renderTool({
      id: 'failed-command', type: 'tool_call', name: 'bash', status: 'error',
    }, BashCard)
    expect(element.textContent).not.toMatch(/exit \d/)
    expect(element.querySelector('[class*="red-"]')).not.toBeNull()
  })

  it('shows the action summary while keeping tool details collapsed', () => {
    const element = renderTool({
      id: 'call-1',
      type: 'tool_call',
      name: 'search_database',
      summary: 'Find the customer account',
      args: { query: 'private@example.com' },
      status: 'done',
      result: 'private result',
    } as ToolCallUI)

    expect(element.textContent).toContain('Find the customer account')
    expect(element.textContent).not.toContain('search_database')
    expect(element.textContent).not.toContain('private@example.com')
    expect(element.textContent).not.toContain('private result')

    const disclosure = element.querySelector<HTMLButtonElement>('button')!
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    act(() => disclosure.click())
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(element.textContent).toContain('search_database')
    expect(element.textContent).toContain('private@example.com')
    expect(element.textContent).toContain('private result')
  })

  it.each([undefined, '', ' '.repeat(4), 'x'.repeat(241)])(
    'uses a deterministic action fallback for invalid summary %j',
    summary => {
      const element = renderTool({
        id: 'call-fallback', type: 'tool_call', name: 'read_file', summary,
        args: { path: '/tmp/private' }, status: 'running',
      } as ToolCallUI)

      expect(element.textContent).toContain('Using read file')
      expect(element.textContent).not.toContain('/tmp/private')
    },
  )
})


it.each([
  ['{"exit_code":127,"stderr":"command not found"}', 'exit 127'],
  ['Process exited with code 2', 'exit 2'],
  ['Command failed with exit code 137', 'exit 137'],
])('shows the reported command exit code: %s', (result, label) => {
  const element = renderTool({ id: 'failed', type: 'tool_call', name: 'bash', status: 'error', result }, BashCard)
  expect(element.textContent).toContain(label)
})

it('renders a user rejection neutrally', () => {
  const element = renderTool({ id: 'rejected', type: 'tool_call', name: 'bash', status: 'error', result: 'Tool execution rejected by user' }, BashCard)
  expect(element.textContent).toContain('Rejected by you')
  expect(element.textContent).not.toMatch(/exit \d/)
  expect(element.querySelector('[class*="red-"]')).toBeNull()
})

it('does not round a measured short duration down to zero', () => {
  const element = renderTool({ id: 'fast', type: 'tool_call', name: 'bash', status: 'done', timing_ms: 12 }, BashCard)
  expect(element.textContent).not.toContain('0.0s')
  expect(element.textContent).toContain('12ms')
})

it('uses the final SDK exit code rather than an exit code printed by the command', () => {
  const element = renderTool({ id: 'last-exit', type: 'tool_call', name: 'bash', status: 'error', result: 'example: Exit code: 0\nExit code: 2\n' }, BashCard)
  expect(element.textContent).toContain('exit 2')
  expect(element.textContent).not.toContain('exit 0')
})
it.each(['log: user rejected a request\nExit code: 1', 'Tool execution rejected by user\nExit code: 1'])('does not label command output as your rejection: %s', result => {
  const element = renderTool({ id: 'quoted-rejection', type: 'tool_call', name: 'bash', status: 'error', result }, BashCard)
  expect(element.textContent).not.toContain('Rejected by you')
  expect(element.textContent).toContain('exit 1')
})
