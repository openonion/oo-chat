/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ModeStatusBar } from './mode-indicator'
import type { HostPermissionOption } from './mode-policy'

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

const availableExecutionProfiles: HostPermissionOption[] = [
  { id: ':workspace', wireId: ':workspace', profile: 'default', name: 'Auto' },
]

function render(permissionProfileChangePending = false) {
  if (!container) {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  }
  act(() => root!.render(
    <ModeStatusBar
      collaborationMode="default"
      executionProfile="default"
      onCollaborationModeChange={vi.fn()}
      onExecutionProfileChange={vi.fn()}
      availableExecutionProfiles={availableExecutionProfiles}
      permissionProfileChangePending={permissionProfileChangePending}
    />,
  ))
  return container
}

describe('ModeStatusBar', () => {
  it('resets an open permission menu while a Host mode change is pending', () => {
    const element = render()
    const permission = element.querySelector<HTMLButtonElement>('[aria-label="Permission: Auto"]')!

    expect(permission.disabled).toBe(false)
    act(() => permission.click())
    expect(element.querySelector('[role="menu"]')).not.toBeNull()

    render(true)
    expect(element.querySelector('[role="menu"]')).toBeNull()
    expect(element.querySelector<HTMLButtonElement>('[aria-label="Permission: Auto"]')?.disabled).toBe(true)

    render(false)
    expect(element.querySelector('[role="menu"]')).toBeNull()
  })
})
