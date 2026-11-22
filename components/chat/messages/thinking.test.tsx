/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Thinking } from './thinking'
import type { ThinkingUI } from '../types'

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

function render(thinking: ThinkingUI) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<Thinking thinking={thinking} />))
  return container
}

describe('Thinking', () => {
  it('hides a completed state that has no real telemetry', () => {
    const element = render({ id: 'bare', type: 'thinking', status: 'done' })

    expect(element.textContent).toBe('')
    expect(element.textContent).not.toContain('0 tok')
  })

  it('keeps the completion facts the Host did provide', () => {
    const element = render({
      id: 'measured',
      type: 'thinking',
      status: 'done',
      model: 'Codex',
      usage: { total_tokens: 42 },
      duration_ms: 1_200,
    })

    expect(element.textContent).toContain('Codex')
    expect(element.textContent).toContain('42 tok')
    expect(element.textContent).toContain('1s')
  })

  it('shows exact cache classes without exposing implementation details', () => {
    const element = render({
      id: 'cache-accounting',
      type: 'thinking',
      status: 'done',
      usage: {
        input_tokens_total: 600,
        input_tokens_uncached: 100,
        cache_read_input_tokens: 200,
        cache_write_input_tokens: 300,
        output_tokens: 50,
        total_tokens: 650,
        cost: 0.002685,
      },
    } as ThinkingUI)

    expect(element.textContent).toContain('100 new')
    expect(element.textContent).toContain('200 cached')
    expect(element.textContent).toContain('300 cache write')
    expect(element.textContent).toContain('50 out')
    expect(element.textContent).toContain('$0.0027')
  })

  it('shows a CSS dot wave while running and announces one stable status', () => {
    const element = render({ id: 'run', type: 'thinking', status: 'running' })
    expect(element.querySelector('.status-wave')?.children.length).toBe(3)
    const live = element.querySelector('[role="status"][aria-live="polite"]')
    expect(live?.textContent).toBe('Agent is working')
    // The rotating gerund and the clock are visual only.
    expect(element.querySelector('[aria-hidden="true"].font-medium')).not.toBeNull()
  })

  it('resolves the dots to a check and announces Done when the run ends', () => {
    const element = render({ id: 'run', type: 'thinking', status: 'running' })
    const live = element.querySelector('[role="status"]')
    act(() => root!.render(<Thinking thinking={{ id: 'run', type: 'thinking', status: 'done' }} />))
    expect(element.querySelector('.status-wave')).toBeNull()
    expect(element.querySelector('svg.status-check')).not.toBeNull()
    // The same live region, now saying the run is done.
    expect(element.querySelector('[role="status"]')).toBe(live)
    expect(live?.textContent).toBe('Done')
  })
})

