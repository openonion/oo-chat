/**
 * @vitest-environment jsdom
 */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ChatAskUser } from './chat-ask-user'
import { DISABLED_OPTION_PREFIX, normalizeAskUserOptions } from './ask-user-options'
import { AskUserCard } from './messages/tools/ask-user-card'
import type { PendingAskUser, ToolCallUI } from './types'

let container: HTMLDivElement | null = null
let root: Root | null = null

function render(node: React.ReactElement) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root?.render(node))
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

const disabled = `${DISABLED_OPTION_PREFIX}1. Jinpeng Li — Already connected`
const enabled = 'Connect with 2. Jinpeng Li — Send invitation'
const pending: PendingAskUser = {
  question: 'Choose one person.',
  options: [disabled, enabled],
  disabled_options: [disabled],
  multi_select: false,
}

function optionButton(element: HTMLElement, text: string): HTMLButtonElement {
  const button = [...element.querySelectorAll('button')]
    .find(candidate => candidate.textContent?.includes(text))
  if (!button) throw new Error(`Missing option button: ${text}`)
  return button
}

describe('disabled ask-user options', () => {
  test('normalizes the server marker without changing enabled answer values', () => {
    expect(normalizeAskUserOptions([disabled, enabled], [disabled])).toEqual([
      { value: disabled, label: '1. Jinpeng Li — Already connected', disabled: true },
      { value: enabled, label: enabled, disabled: false },
    ])
  })

  test('renders a disabled native button in the inline tool card', () => {
    const onResponse = vi.fn()
    const toolCall = {
      id: 'ask-user-1',
      type: 'tool_call',
      name: 'ask_user',
      status: 'running',
      args: { question: pending.question },
    } as unknown as ToolCallUI
    const element = render(
      <AskUserCard
        toolCall={toolCall}
        pendingAskUser={pending}
        onAskUserResponse={onResponse}
      />,
    )

    const unavailable = optionButton(element, 'Already connected')
    expect(unavailable.disabled).toBe(true)
    expect(unavailable.textContent).not.toContain(DISABLED_OPTION_PREFIX)
    act(() => unavailable.click())
    expect(onResponse).not.toHaveBeenCalled()
    expect(element.querySelector('input[placeholder="Something else..."]')).toBeNull()

    act(() => optionButton(element, 'Send invitation').click())
    expect(onResponse).toHaveBeenCalledWith(enabled)
  })

  test('applies the same disabled behaviour to the standalone prompt', () => {
    const onResponse = vi.fn()
    const element = render(<ChatAskUser askUser={pending} onResponse={onResponse} />)

    const unavailable = optionButton(element, 'Already connected')
    expect(unavailable.disabled).toBe(true)
    expect(unavailable.textContent).not.toContain(DISABLED_OPTION_PREFIX)
    act(() => unavailable.click())
    expect(onResponse).not.toHaveBeenCalled()
    expect(element.querySelector('input[placeholder="Custom answer..."]')).toBeNull()
  })
})
