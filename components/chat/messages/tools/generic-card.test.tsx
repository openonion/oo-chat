/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ToolCallUI } from '../../types'
import { GenericCard } from './generic-card'

vi.mock('./approval-buttons', () => ({ ApprovalButtons: () => null }))

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: Root | null = null

function renderTool(toolCall: ToolCallUI) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<GenericCard toolCall={toolCall} />))
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('GenericCard action-summary disclosure', () => {
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
