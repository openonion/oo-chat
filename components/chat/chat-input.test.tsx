/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('./composer-voice-input', () => ({
  useComposerVoiceInput: () => ({ isRecording: false, isTranscribing: false }),
  ComposerVoiceButton: () => null,
  ComposerVoiceFeedback: () => null,
}))

import { ChatInput } from './chat-input'

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
  vi.useRealTimers()
})

function render(props: Partial<Parameters<typeof ChatInput>[0]>) {
  container ??= document.body.appendChild(document.createElement('div'))
  root ??= createRoot(container)
  act(() => root!.render(<ChatInput onSend={() => {}} {...props} />))
  return container
}

const button = () => container!.querySelector<HTMLButtonElement>('[data-composer-state]')!
function type(text: string) {
  const area = container!.querySelector('textarea')!
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
  act(() => {
    setter.call(area, text)
    area.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('composer send button', () => {
  it('is one control that morphs idle → sending → running, keeping its node and focus', () => {
    const onSend = vi.fn()
    const onStop = vi.fn()
    render({ onSend, onStop, isLoading: false })
    const idle = button()
    expect(idle.dataset.composerState).toBe('idle')
    expect(idle.getAttribute('aria-label')).toBe('Send message')
    expect(idle.disabled).toBe(true) // nothing typed yet

    type('Ship it')
    expect(button().disabled).toBe(false)
    act(() => { button().focus(); button().click() })
    expect(onSend).toHaveBeenCalledWith('Ship it', undefined, undefined)
    expect(button().dataset.composerState).toBe('sending')
    expect(button().getAttribute('aria-busy')).toBe('true')

    render({ onSend, onStop, isLoading: true })
    const running = button()
    expect(running).toBe(idle) // the same DOM node: focus is not dropped
    expect(running.dataset.composerState).toBe('running')
    expect(running.getAttribute('aria-label')).toBe('Stop agent')
    expect(document.activeElement).toBe(running)
    act(() => running.click())
    expect(onStop).toHaveBeenCalledOnce()

    render({ onSend, onStop, isLoading: false })
    expect(button().dataset.composerState).toBe('idle')
  })

  it('never stays stuck mid-send when the agent does not start', () => {
    vi.useFakeTimers()
    render({ onSend: () => {}, onStop: () => {}, isLoading: false })
    type('Hello')
    act(() => button().click())
    expect(button().dataset.composerState).toBe('sending')
    act(() => { vi.advanceTimersByTime(2100) })
    expect(button().dataset.composerState).toBe('idle')
  })
})
