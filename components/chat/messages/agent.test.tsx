/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { Agent } from './agent'
import type { AgentUI } from '../types'

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

const message = (content: string): AgentUI => ({ id: 'reply-1', type: 'agent', content } as AgentUI)

function render(content: string, streaming: boolean) {
  container ??= document.body.appendChild(document.createElement('div'))
  root ??= createRoot(container)
  act(() => root!.render(<Agent message={message(content)} streaming={streaming} showCopy={false} />))
  return container
}

describe('Agent streaming', () => {
  it('blurs in the newest words of a reply that is still streaming', () => {
    const el = render('Read the page and rebuilt the site', true)
    expect(el.querySelector('[data-streaming]')).not.toBeNull()
    expect(el.querySelectorAll('.stream-word').length).toBe(7)
    expect(el.querySelectorAll('.stream-word.is-fresh').length).toBe(7)
    expect(el.textContent).toContain('Read the page and rebuilt the site')
  })

  it('renders a finished reply as plain markdown, with no per-word spans', () => {
    const el = render('Read the page and rebuilt the site', false)
    expect(el.querySelector('[data-streaming]')).toBeNull()
    expect(el.querySelectorAll('.stream-word').length).toBe(0)
  })
})
