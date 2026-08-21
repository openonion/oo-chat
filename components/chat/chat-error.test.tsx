/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ChatError } from './chat-error'

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

function render(error: string, onRetry = vi.fn(), onReconnect = vi.fn()) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(
    <ChatError error={error} onRetry={onRetry} onReconnect={onReconnect} />,
  ))
  return { container, onRetry, onReconnect }
}

describe('ChatError recovery action', () => {
  it('reconnects without resending after a reconnect timeout', () => {
    const view = render('Reconnect timed out')
    const action = view.container.querySelector<HTMLButtonElement>('button')!

    expect(action.textContent).toBe('Reconnect')
    act(() => action.click())
    expect(view.onReconnect).toHaveBeenCalledOnce()
    expect(view.onRetry).not.toHaveBeenCalled()
  })

  it('keeps Retry for a failed turn', () => {
    const view = render('Provider rejected the turn')
    const action = view.container.querySelector<HTMLButtonElement>('button')!

    expect(action.textContent).toBe('Retry')
    act(() => action.click())
    expect(view.onRetry).toHaveBeenCalledOnce()
    expect(view.onReconnect).not.toHaveBeenCalled()
  })
})
