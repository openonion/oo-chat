/** @vitest-environment jsdom */

import { act, type ComponentProps } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CodingAgentCard } from './coding-agent-card'
import { voiceErrorMessage } from '../composer-voice-input'
import type { ProviderInvocationUI } from '../types'

const voiceMock = vi.hoisted(() => ({
  onTranscribed: undefined as undefined | ((text: string) => void),
  startRecording: vi.fn(async () => undefined),
  stopRecording: vi.fn(),
  cancelRecording: vi.fn(),
}))

vi.mock('@connectonion/react', () => ({
  useVoiceInput: (options: { onTranscribed?: (text: string) => void }) => {
    voiceMock.onTranscribed = options.onTranscribed
    return {
      status: 'idle',
      isRecording: false,
      isTranscribing: false,
      duration: 0,
      error: null,
      startRecording: voiceMock.startRecording,
      stopRecording: voiceMock.stopRecording,
      cancelRecording: voiceMock.cancelRecording,
      text: '',
    }
  },
}))

beforeAll(() => {
  ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

let container: HTMLDivElement | null = null
let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  container = null
  root = null
  voiceMock.onTranscribed = undefined
  vi.clearAllMocks()
})

function invocation(provider: 'codex' | 'claude_code', status: ProviderInvocationUI['status'] = 'completed'): ProviderInvocationUI {
  const providerDisplayName = provider === 'codex' ? 'Codex' : 'Claude Code'
  return {
    id: `${provider}:voice-test`,
    type: 'provider_invocation',
    parentToolCallId: 'voice-test',
    provider,
    providerDisplayName,
    taskTitle: 'Continue the provider session',
    taskSummary: 'Continue the provider session',
    status,
    activities: [],
    messages: [{ id: 'assistant-1', role: 'assistant', text: 'Ready for the next instruction.' }],
  }
}

function openRoom(provider: 'codex' | 'claude_code', status: ProviderInvocationUI['status'] = 'completed', props: Partial<ComponentProps<typeof CodingAgentCard>> = {}) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const onProviderInput = vi.fn().mockResolvedValue({ stateRevision: 2 })
  act(() => root!.render(
    <CodingAgentCard invocation={invocation(provider, status)} onProviderInput={onProviderInput} {...props} />,
  ))
  const open = Array.from(container.querySelectorAll('button'))
    .find(button => button.textContent?.includes('Open Work Room'))
  act(() => open!.click())
  return {
    room: document.querySelector<HTMLElement>('[role="dialog"]')!,
    onProviderInput,
  }
}

describe('Work Room voice input', () => {
  it.each(['reconnecting', 'disconnected'] as const)('shows the shared %s transport indicator inside Work Room', sessionState => {
    const onReconnect = vi.fn()
    const { room } = openRoom('codex', 'running', { sessionState, onReconnect })
    expect(room.querySelector(`[data-activity-phase="${sessionState}"]`)).not.toBeNull()
    expect(room.textContent).not.toContain('live')
    if (sessionState === 'disconnected') {
      act(() => Array.from(room.querySelectorAll('button')).find(button => button.textContent === 'Reconnect')!.click())
      expect(onReconnect).toHaveBeenCalledOnce()
    }
  })

  it('labels stopped provider activity neutrally in execution details', () => {
    const item = invocation('codex')
    item.activities = [{ id: 'paused-check', name: 'bash', title: 'Check workspace', status: 'stopped' } as ProviderInvocationUI['activities'][number]]
    const { room } = openRoom('codex', 'completed', { invocation: item })
    const details = Array.from(room.querySelectorAll('details')).find(node => node.querySelector('summary')?.textContent?.includes('Task details'))!
    act(() => { details.open = true })
    const row = room.querySelector('[data-tool-status="stopped"]')!.closest('li')!
    expect(row.textContent).toContain('Stopped')
    expect(row.querySelector('[class*="red-"]')).toBeNull()
  })

  it.each([
    ['codex', 'Codex'],
    ['claude_code', 'Claude Code'],
  ] as const)('adds %s transcription to only its provider draft and waits for explicit send', async (provider, label) => {
    const { room, onProviderInput } = openRoom(provider)
    const composer = room.querySelector<HTMLTextAreaElement>(`[aria-label="Message ${label} directly"]`)!
    const voiceButton = room.querySelector<HTMLButtonElement>(`[aria-label="Start ${label} voice input"]`)!

    expect(voiceButton).not.toBeNull()
    expect(voiceButton.disabled).toBe(false)
    act(() => voiceMock.onTranscribed?.('Please verify the release fixture.'))

    expect(composer.value).toBe('Please verify the release fixture.')
    expect(onProviderInput).not.toHaveBeenCalled()
    await act(async () => {
      room.querySelector<HTMLButtonElement>(`[aria-label="Send message to ${label}"]`)!.click()
      await Promise.resolve()
    })
    expect(onProviderInput).toHaveBeenCalledWith(
      `${provider}:voice-test`,
      'Please verify the release fixture.',
    )
  })

  it('keeps Claude Code voice disabled while that provider cannot accept input', () => {
    const { room } = openRoom('claude_code', 'running')
    expect(room.querySelector<HTMLButtonElement>('[aria-label="Start Claude Code voice input"]')?.disabled).toBe(true)
  })

  it('uses actionable microphone errors shared with the outer composer', () => {
    expect(voiceErrorMessage(new DOMException('Permission denied', 'NotAllowedError')))
      .toContain('browser settings')
    expect(voiceErrorMessage(new DOMException('Requested device not found', 'NotFoundError')))
      .toContain('No microphone found')
  })
})
