/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ToolCallUI } from '../../types'
import { AskUserCard } from './ask-user-card'

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: Root | null = null

function renderCard(multiSelect: boolean, qrImage?: string) {
  const question = qrImage ? 'Scan QR code to sign in' : 'Choose an environment'
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const onAskUserResponse = vi.fn()
  act(() => root!.render(
    <AskUserCard
      toolCall={{ id: 'question', type: 'tool_call', name: 'ask_user', args: { question }, status: 'running' } as ToolCallUI}
      pendingAskUser={{ question, options: ['staging', 'production'], multi_select: multiSelect }}
      onAskUserResponse={onAskUserResponse}
      qrImage={qrImage}
    />,
  ))
  return { element: container, onAskUserResponse }
}

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
})

describe('AskUserCard interactions', () => {
  it('exposes the question disclosure as a keyboard-reachable button', () => {
    const { element } = renderCard(false)
    const disclosure = Array.from(element.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Choice Required'))!
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    act(() => disclosure.click())
    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    act(() => disclosure.click())
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
  })

  it('announces multi-select state without submitting until confirmation', () => {
    const { element, onAskUserResponse } = renderCard(true)
    const staging = Array.from(element.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'staging')!
    expect(staging.getAttribute('aria-pressed')).toBe('false')
    act(() => staging.click())
    expect(staging.getAttribute('aria-pressed')).toBe('true')
    expect(onAskUserResponse).not.toHaveBeenCalled()
    const submit = Array.from(element.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Submit'))!
    act(() => submit.click())
    expect(onAskUserResponse).toHaveBeenCalledWith(['staging'])
  })

  it('moves focus into the QR dialog and Escape closes it', () => {
    const { element } = renderCard(false, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlRjyoAAAAASUVORK5CYII=')
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Scan to sign in"]')!
    expect(dialog).not.toBeNull()
    expect(document.activeElement).toBe(dialog.querySelector('[aria-label="Close sign-in dialog"]'))
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(element.querySelector('button[aria-expanded]')).not.toBeNull()
  })
})
