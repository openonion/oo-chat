/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CodingAgentCard } from './coding-agent-card'
import type { ProviderInvocationUI } from '../types'

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

const invocation: ProviderInvocationUI = {
  id: 'codex:call-7', type: 'provider_invocation', parentToolCallId: 'call-7',
  provider: 'codex', providerDisplayName: 'Codex', taskSummary: 'Fix Windows tests',
  status: 'running', activities: [{
    id: 'a', name: 'Bash', status: 'done', args: { command: 'pytest tests/unit' }, result: '89 passed',
  }],
}

function render(overrides: Partial<Parameters<typeof CodingAgentCard>[0]> = {}) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const props = { invocation, expanded: false, onToggle: vi.fn(), onStop: vi.fn(), ...overrides }
  act(() => root!.render(<CodingAgentCard {...props} />))
  return { element: container, props }
}

describe('CodingAgentCard', () => {
  it('keeps the transcript compact while exposing status and stop', () => {
    const { element, props } = render()
    expect(element.textContent).toContain('Codex')
    expect(element.textContent).toContain('Fix Windows tests')
    expect(element.textContent).not.toContain('pytest tests/unit')
    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Stop Codex"]')!.click())
    expect(props.onStop).toHaveBeenCalledOnce()
  })

  it('shows nested activity inline when expanded without horizontal overflow classes', () => {
    const { element } = render({ expanded: true })
    expect(element.textContent).toContain('pytest tests/unit')
    expect(element.textContent).toContain('89 passed')
    expect(element.querySelector('section')?.className).toContain('min-w-0')
    expect(element.querySelector('section')?.className).toContain('overflow-hidden')
  })

  it('removes Stop after a terminal event', () => {
    const { element } = render({ invocation: { ...invocation, status: 'cancelled' } })
    expect(element.querySelector('[aria-label="Stop Codex"]')).toBeNull()
  })
})
