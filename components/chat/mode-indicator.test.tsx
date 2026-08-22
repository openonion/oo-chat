/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ModeStatusBar } from './mode-indicator'
import type { HostModeOption } from './mode-policy'

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

const availableModes: HostModeOption[] = [
  { id: 'auto', name: 'Auto' },
]

function render(modeChangePending = false) {
  if (!container) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  }
  act(() => root!.render(
    <ModeStatusBar
      mode="auto"
      onModeChange={vi.fn()}
      availableModes={availableModes}
      modeChangePending={modeChangePending}
    />,
  ))
  return container
}

describe('ModeStatusBar', () => {
  it('resets an open mode menu while a Host acknowledgement is pending', () => {
    const element = render()
    const modeButton = element.querySelector<HTMLButtonElement>('[aria-label="Mode: Auto"]')!

    expect(modeButton.disabled).toBe(false)
    act(() => modeButton.click())
    expect(element.querySelector('[role="menu"]')).not.toBeNull()

    render(true)
    expect(element.querySelector('[role="menu"]')).toBeNull()
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Mode: Auto"]')?.disabled).toBe(true)

    render(false)
    expect(element.querySelector('[role="menu"]')).toBeNull()
  })
})
