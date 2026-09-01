/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ControlCenterAppPane } from './control-center-app-pane'
import type { ControlCenterAppDescriptor } from './control-center-app'

const REVISION = `sha256:${'c'.repeat(64)}`
const APP: ControlCenterAppDescriptor = {
  schema: 'connectonion.control-app/1',
  revision: REVISION,
  url: 'https://control-center.example/invoices',
  sdk_version: '1',
  review: { status: 'approved' },
}

class FakePort {
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  start = vi.fn()
  close = vi.fn()

  request(data: Record<string, unknown>) {
    this.onmessage?.({ data } as MessageEvent)
  }
}

class FakeChannel {
  static instances: FakeChannel[] = []
  port1 = new FakePort()
  port2 = new FakePort()

  constructor() {
    FakeChannel.instances.push(this)
  }
}

const NativeMessageChannel = globalThis.MessageChannel

let container: HTMLDivElement | null = null
let root: Root | null = null

function renderPane(node: React.ReactElement) {
  container = document.createElement('div')
  container.style.height = '600px'
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(node))
  return container
}

beforeEach(() => {
  FakeChannel.instances = []
  globalThis.MessageChannel = FakeChannel as unknown as typeof MessageChannel
})

afterEach(() => {
  if (root) act(() => root!.unmount())
  container?.remove()
  root = null
  container = null
  globalThis.MessageChannel = NativeMessageChannel
})

function connect(frame: HTMLIFrameElement) {
  act(() => frame.dispatchEvent(new Event('load')))
  return FakeChannel.instances.at(-1)!
}

describe('ControlCenterAppPane', () => {
  it('does not mount a reviewing revision', () => {
    const element = renderPane(
      <ControlCenterAppPane
        app={{ ...APP, review: { status: 'reviewing' } }}
        agentAddress="0xagent"
        sessionId={null}
        skills={[]}
        onSendMessage={vi.fn()}
        onRunSkill={vi.fn()}
      />,
    )
    expect(element.querySelector('iframe[title="Agent Control Center app"]')).toBeNull()
    expect(element.querySelector('[role="status"]')?.textContent).toMatch(/being reviewed/i)
  })

  it('sends context only to the approved app origin', async () => {
    const element = renderPane(
      <ControlCenterAppPane
        app={APP}
        agentAddress="0xagent"
        agentName="Invoice Agent"
        sessionId="session-1"
        skills={[{ name: 'generate-invoice' }]}
        onSendMessage={vi.fn()}
        onRunSkill={vi.fn()}
      />,
    )
    const frame = element.querySelector('iframe[title="Agent Control Center app"]') as HTMLIFrameElement
    const post = vi.spyOn(frame.contentWindow!, 'postMessage')
    const channel = connect(frame)

    expect(post).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connectonion.control-center/connect',
        revision: REVISION,
      }),
      'https://control-center.example',
      [channel.port2],
    )
    expect(channel.port1.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connectonion.control-center/context',
        conversation: { sessionId: 'session-1' },
      }),
    )
  })

  it('runs an allowlisted invoice skill in the current chat by default', async () => {
    const onRunSkill = vi.fn().mockResolvedValue({ sessionId: 'session-1' })
    const element = renderPane(
      <ControlCenterAppPane
        app={APP}
        agentAddress="0xagent"
        sessionId="session-1"
        skills={[{ name: 'generate-invoice' }]}
        onSendMessage={vi.fn()}
        onRunSkill={onRunSkill}
      />,
    )
    const frame = element.querySelector('iframe[title="Agent Control Center app"]') as HTMLIFrameElement
    const channel = connect(frame)

    await act(async () => {
      channel.port1.request({
        type: 'connectonion.control-center/request',
        version: 1,
        revision: REVISION,
        id: 'invoice-1',
        action: 'run_skill',
        payload: { skill: 'generate-invoice', args: 'invoice 1042' },
      })
      await Promise.resolve()
    })

    expect(onRunSkill).toHaveBeenCalledWith(
      'generate-invoice',
      'invoice 1042',
      'current',
    )
  })

  it('honors an explicit new-conversation message action', async () => {
    const onSendMessage = vi.fn().mockResolvedValue({ sessionId: 'session-2' })
    const element = renderPane(
      <ControlCenterAppPane
        app={APP}
        agentAddress="0xagent"
        sessionId="session-1"
        skills={[]}
        onSendMessage={onSendMessage}
        onRunSkill={vi.fn()}
      />,
    )
    const frame = element.querySelector('iframe[title="Agent Control Center app"]') as HTMLIFrameElement
    const channel = connect(frame)

    await act(async () => {
      channel.port1.request({
        type: 'connectonion.control-center/request',
        version: 1,
        revision: REVISION,
        id: 'message-1',
        action: 'send_message',
        payload: { message: 'Explain this invoice', conversation: 'new' },
      })
      await Promise.resolve()
    })

    expect(onSendMessage).toHaveBeenCalledWith(
      'Explain this invoice',
      'new',
    )
  })

  it('rejects a skill the Agent did not publish', async () => {
    const onRunSkill = vi.fn()
    const element = renderPane(
      <ControlCenterAppPane
        app={APP}
        agentAddress="0xagent"
        sessionId="session-1"
        skills={[{ name: 'generate-invoice' }]}
        onSendMessage={vi.fn()}
        onRunSkill={onRunSkill}
      />,
    )
    const frame = element.querySelector('iframe[title="Agent Control Center app"]') as HTMLIFrameElement
    const channel = connect(frame)

    await act(async () => {
      channel.port1.request({
        type: 'connectonion.control-center/request',
        version: 1,
        revision: REVISION,
        id: 'admin-1',
        action: 'run_skill',
        payload: { skill: 'delete-everything' },
      })
      await Promise.resolve()
    })

    expect(channel.port1.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'action_rejected' }) }),
    )
    expect(onRunSkill).not.toHaveBeenCalled()
  })
})
