/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import type { PlanEntry } from '@connectonion/react'
import { CurrentTodoListPanel } from './current-plan-panel'

let container: HTMLDivElement | null = null
let root: Root | null = null

function render(entries: ReadonlyArray<PlanEntry>) {
  if (!container) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  }
  act(() => root!.render(<CurrentTodoListPanel entries={entries} />))
  return container
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('CurrentTodoListPanel', () => {
  it('shows every OIP status and priority as accessible text', () => {
    const element = render([
      { content: 'Inspect history', status: 'pending', priority: 'high' },
      { content: 'Implement change', status: 'in_progress', priority: 'medium' },
      { content: 'Review code', status: 'completed', priority: 'low' },
    ])

    expect(element.querySelector('[aria-label="Current Todo List"]')).not.toBeNull()
    expect(element.textContent).toContain('Pending')
    expect(element.textContent).toContain('In progress')
    expect(element.textContent).toContain('Completed')
    expect(element.textContent).toContain('High priority')
    expect(element.textContent).toContain('Medium priority')
    expect(element.textContent).toContain('Low priority')
    expect(element.querySelectorAll('button')).toHaveLength(0)
  })

  it('replaces the whole list and removes the panel when the Todo List clears', () => {
    const element = render([
      { content: 'Old step', status: 'pending', priority: 'medium' },
    ])

    render([{ content: 'Replacement step', status: 'in_progress', priority: 'high' }])
    expect(element.textContent).not.toContain('Old step')
    expect(element.textContent).toContain('Replacement step')

    render([])
    expect(element.querySelector('[aria-label="Current Todo List"]')).toBeNull()
  })
})
