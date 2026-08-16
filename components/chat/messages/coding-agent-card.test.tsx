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
    expect(element.querySelector('[aria-label="Live activity snapshot"]')).not.toBeNull()
    act(() => element.querySelector<HTMLButtonElement>('[aria-label="Stop Codex"]')!.click())
    expect(props.onStop).toHaveBeenCalledOnce()
  })

  it('keeps a long provider instruction out of the collapsed card and default Work Room view', () => {
    const providerInstruction = 'Please work entirely inside the directory .workroom-e2e. Create a deterministic Python Dijkstra implementation, inspect it, run three command-line cases, add focused pytest tests, run pytest, inspect output, and report the final acceptance marker.'
    const { element } = render({ invocation: { ...invocation, taskSummary: providerInstruction } })

    expect(element.textContent).toContain('Codex work room')
    expect(element.textContent).not.toContain(providerInstruction)
    expect(element.querySelector('.line-clamp-2')).not.toBeNull()

    act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Open Work Room'))!.click())
    const workroom = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Codex Work Room"]')!
    expect(workroom.textContent).not.toContain(providerInstruction)

    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Chat'))!.click())
    expect(workroom.textContent).toContain(providerInstruction)
  })

  it('shows semantic nested activity inline and keeps raw details behind disclosure', () => {
    const { element } = render({ expanded: true })
    expect(element.textContent).toContain('Running tests')
    const details = element.querySelector('details')!
    expect(details.open).toBe(false)
    details.open = true
    expect(element.textContent).toContain('pytest tests/unit')
    expect(element.textContent).toContain('89 passed')
    expect(element.querySelector('section')?.className).toContain('min-w-0')
    expect(element.querySelector('section')?.className).toContain('overflow-hidden')
  })

  it('removes Stop after a terminal event', () => {
    const { element } = render({ invocation: { ...invocation, status: 'cancelled' } })
    expect(element.querySelector('[aria-label="Stop Codex"]')).toBeNull()
  })

  it('opens an interactive Work Room and targets messages to Codex', () => {
    const onMessageProvider = vi.fn()
    const { element } = render({ onMessageProvider })

    act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Open Work Room'))!.click())
    const workroom = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Codex Work Room"]')!
    expect(workroom).not.toBeNull()
    expect(workroom.textContent).toContain('Fix Windows tests')
    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Chat'))!.click())

    const composer = workroom.querySelector<HTMLTextAreaElement>('textarea')!
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
      setter.call(composer, 'Also update the changelog')
      composer.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => workroom.querySelector<HTMLButtonElement>('[aria-label="Send to Codex"]')!.click())

    expect(onMessageProvider).toHaveBeenCalledWith('Also update the changelog')
    expect(workroom.textContent).toContain('Queued #1 to Codex')
  })

  it('reconciles a queued message with a resumed provider result', () => {
    const continuation: ProviderInvocationUI = {
      ...invocation,
      id: 'codex:call-8',
      parentToolCallId: 'call-8',
      sessionId: 'codex-session-1',
      taskSummary: 'Also update the changelog',
      status: 'completed',
      result: 'Changelog updated.',
    }
    const { element } = render({
      invocation: { ...invocation, sessionId: 'codex-session-1' },
      continuations: [continuation],
    })

    act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Open Work Room'))!.click())
    const workroom = document.querySelector<HTMLElement>('[role="dialog"]')!
    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Chat'))!.click())
    expect(workroom.textContent).toContain('Completed #1 by Codex')
    expect(workroom.textContent).toContain('Also update the changelog')
    expect(workroom.textContent).toContain('Changelog updated.')
  })

  it('keeps the first result before resumed messages in chronological order', () => {
    const continuation: ProviderInvocationUI = {
      ...invocation,
      id: 'codex:call-8',
      parentToolCallId: 'call-8',
      sessionId: 'codex-session-1',
      taskSummary: 'Second request',
      status: 'completed',
      result: 'Second result',
    }
    const { element } = render({
      invocation: {
        ...invocation,
        sessionId: 'codex-session-1',
        status: 'completed',
        result: 'First result',
      },
      continuations: [continuation],
    })

    act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Open Work Room'))!.click())
    const workroom = document.querySelector<HTMLElement>('[role="dialog"]')!
    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Chat'))!.click())
    const text = workroom.textContent!
    expect(text.indexOf('First result')).toBeLessThan(text.indexOf('Second request'))
    expect(text.indexOf('Second request')).toBeLessThan(text.indexOf('Second result'))
  })

  it('tracks resumed status, activity and files across the provider session', () => {
    const continuation: ProviderInvocationUI = {
      ...invocation,
      id: 'codex:call-8',
      parentToolCallId: 'call-8',
      sessionId: 'codex-session-1',
      taskSummary: 'Continue',
      status: 'running',
      activities: [{
        id: 'file-2', name: 'Edit', status: 'done',
        args: { file_path: 'src/resumed.ts' }, result: 'updated',
      }],
    }
    const { element } = render({
      invocation: { ...invocation, sessionId: 'codex-session-1', status: 'completed' },
      continuations: [continuation],
    })

    act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Open Work Room'))!.click())
    const workroom = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(workroom.querySelector('[aria-label="Stop Codex"]')).not.toBeNull()

    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Activity'))!.click())
    expect(workroom.textContent).toContain('pytest tests/unit')
    expect(workroom.textContent).toContain('src/resumed.ts')

    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Files'))!.click())
    expect(workroom.textContent).toContain('src/resumed.ts')
  })

  it('exposes Activity and Files as full Work Room sections', () => {
    const withFile = {
      ...invocation,
      activities: [...invocation.activities, {
        id: 'file-1', name: 'File change', status: 'done' as const,
        args: { file_path: 'src/app.tsx' }, result: 'updated',
      }],
    }
    const { element } = render({ invocation: withFile })
    act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Open Work Room'))!.click())
    const workroom = document.querySelector<HTMLElement>('[role="dialog"]')!

    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Activity'))!.click())
    expect(workroom.textContent).toContain('pytest tests/unit')
    act(() => Array.from(workroom.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(button => button.textContent?.includes('Files'))!.click())
    expect(workroom.textContent).toContain('src/app.tsx')
  })

  it('keeps a long activity history bounded and hides raw details until disclosure', () => {
    const activities = Array.from({ length: 10 }, (_, index) => ({
      id: `step-${index}`,
      name: 'Bash',
      status: index === 9 ? 'running' as const : 'done' as const,
      args: { command: `python3 dijkstra.py --case ${index}` },
      result: `case ${index} passed`,
    }))
    const { element } = render({ invocation: { ...invocation, activities }, expanded: true })

    const activityList = element.querySelector<HTMLOListElement>('[aria-label="Codex activity"]')!
    expect(activityList.className).toContain('max-h-56')
    expect(activityList.className).toContain('overflow-y-auto')
    expect(element.querySelectorAll('details')).toHaveLength(10)
    expect(Array.from(element.querySelectorAll('details')).every(item => !item.open)).toBe(true)
    expect(element.textContent).toContain('Running a Python check')
  })

  it('keeps a native approval visible on the collapsed provider card', () => {
    const onApprovalResponse = vi.fn()
    const { element } = render({
      pendingApproval: {
        id: 'approval-1',
        tool: 'codex',
        arguments: { action: 'Run pytest', cwd: '.workroom-e2e' },
      },
      onApprovalResponse,
    })

    expect(element.querySelector('[aria-label="Approval required for codex"]')).not.toBeNull()
    act(() => Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Allow once'))!.click())
    expect(onApprovalResponse).toHaveBeenCalledWith(true, 'once', undefined)
  })
})
