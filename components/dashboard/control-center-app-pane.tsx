'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CONTROL_CENTER_BRIDGE_VERSION,
  capabilityPolicy,
  conversationTarget,
  parseControlCenterRequest,
  validateControlCenterApp,
  type ControlCenterActionResult,
  type ControlCenterAppDescriptor,
  type ControlCenterConnect,
  type ControlCenterContext,
  type ControlCenterConversationTarget,
  type ControlCenterResponse,
} from './control-center-app'

const MESSAGE_LIMIT = 10_000
const SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
const SKILL_ARGS_LIMIT = 2_000

type Props = {
  app: ControlCenterAppDescriptor | null
  agentAddress: string
  agentName?: string
  sessionId: string | null
  skills: { name: string; description?: string }[]
  onSendMessage: (
    message: string,
    target: ControlCenterConversationTarget,
  ) => Promise<ControlCenterActionResult>
  onRunSkill: (
    skill: string,
    args: string | undefined,
    target: ControlCenterConversationTarget,
  ) => Promise<ControlCenterActionResult>
  className?: string
}

function response(
  revision: string,
  id: string,
  result: ControlCenterActionResult | null,
  error?: { code: string; message: string },
): ControlCenterResponse {
  return {
    type: 'connectonion.control-center/response',
    version: CONTROL_CENTER_BRIDGE_VERSION,
    revision,
    id,
    ok: !error,
    ...(result ? { result } : {}),
    ...(error ? { error } : {}),
  }
}

export function ControlCenterAppPane({
  app,
  agentAddress,
  agentName,
  sessionId,
  skills,
  onSendMessage,
  onRunSkill,
  className,
}: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const portRef = useRef<MessagePort | null>(null)
  const actionRef = useRef({ onSendMessage, onRunSkill, skills })
  const handled = useRef<{ revision: string | null; ids: Set<string> }>({
    revision: null,
    ids: new Set(),
  })
  const [loadedRevision, setLoadedRevision] = useState<string | null>(null)
  const parentOrigin = typeof window === 'undefined' ? '' : window.location.origin
  const validation = useMemo(
    () => validateControlCenterApp(app, parentOrigin),
    [app, parentOrigin],
  )
  const validated = validation.app
  const loaded = Boolean(validated && loadedRevision === validated.revision)

  useEffect(() => {
    actionRef.current = { onSendMessage, onRunSkill, skills }
  }, [onRunSkill, onSendMessage, skills])

  useEffect(() => {
    if (!validated || validated.review.status !== 'approved') return

    if (!loaded) return

    const channel = new MessageChannel()
    const port = channel.port1
    portRef.current = port
    const post = (message: ControlCenterResponse) => port.postMessage(message)

    function onMessage(event: MessageEvent) {
      const parsed = parseControlCenterRequest(event.data, validated!.revision)
      if (!parsed.request) {
        if (parsed.error && parsed.id) {
          post(response(validated!.revision, parsed.id, null, {
            code: 'invalid_request',
            message: parsed.error,
          }))
        }
        return
      }

      const request = parsed.request
      if (handled.current.revision !== validated!.revision) {
        handled.current = { revision: validated!.revision, ids: new Set() }
      }
      if (handled.current.ids.has(request.id)) {
        post(response(validated!.revision, request.id, null, {
          code: 'duplicate_request',
          message: 'This Control Center action was already handled.',
        }))
        return
      }
      handled.current.ids.add(request.id)
      if (handled.current.ids.size > 256) {
        handled.current.ids.delete(handled.current.ids.values().next().value!)
      }

      const target = conversationTarget(request.payload.conversation)
      if (!target) {
        post(response(validated!.revision, request.id, null, {
          code: 'invalid_conversation',
          message: 'Choose the current conversation or a new conversation.',
        }))
        return
      }

      const run = async () => {
        if (request.action === 'send_message') {
          const message = typeof request.payload.message === 'string'
            ? request.payload.message.trim()
            : ''
          if (!message || message.length > MESSAGE_LIMIT) {
            throw new Error(`Message must contain 1–${MESSAGE_LIMIT} characters.`)
          }
          return actionRef.current.onSendMessage(message, target)
        }

        const skill = typeof request.payload.skill === 'string' ? request.payload.skill : ''
        const args = typeof request.payload.args === 'string'
          ? request.payload.args.replace(/\s+/g, ' ').trim()
          : ''
        if (!SKILL_NAME.test(skill) || !actionRef.current.skills.some(item => item.name === skill)) {
          throw new Error('This Agent does not publish that skill.')
        }
        if (args.length > SKILL_ARGS_LIMIT) {
          throw new Error(`Skill arguments must be at most ${SKILL_ARGS_LIMIT} characters.`)
        }
        return actionRef.current.onRunSkill(skill, args || undefined, target)
      }

      void run().then(
        result => post(response(validated!.revision, request.id, result)),
        error => post(response(validated!.revision, request.id, null, {
          code: 'action_rejected',
          message: error instanceof Error ? error.message : 'The action could not be sent.',
        })),
      )
    }

    port.onmessage = onMessage
    port.start()
    const connect: ControlCenterConnect = {
      type: 'connectonion.control-center/connect',
      version: CONTROL_CENTER_BRIDGE_VERSION,
      revision: validated.revision,
    }
    frameRef.current?.contentWindow?.postMessage(connect, validated.origin, [channel.port2])
    return () => {
      if (portRef.current === port) portRef.current = null
      port.onmessage = null
      port.close()
      channel.port2.close()
    }
  }, [loaded, validated])

  useEffect(() => {
    if (!validated || validated.review.status !== 'approved') return
    const port = portRef.current
    if (!port) return
    const context: ControlCenterContext = {
      type: 'connectonion.control-center/context',
      version: CONTROL_CENTER_BRIDGE_VERSION,
      revision: validated.revision,
      agent: { address: agentAddress, ...(agentName ? { name: agentName } : {}) },
      conversation: { sessionId },
      skills: skills.map(skill => ({ ...skill })),
      actions: {
        sendMessage: true,
        runSkill: true,
        conversationTargets: ['current', 'new'],
      },
    }
    port.postMessage(context)
  }, [agentAddress, agentName, loaded, sessionId, skills, validated])

  if (!validated) {
    return (
      <div className={className} role="alert">
        <div className="flex h-full items-center justify-center p-8 text-center">
          <p className="max-w-md text-sm text-neutral-500">{validation.error}</p>
        </div>
      </div>
    )
  }

  if (validated.review.status !== 'approved') {
    const blocked = validated.review.status === 'blocked'
    return (
      <div className={className} role={blocked ? 'alert' : 'status'}>
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="max-w-md">
            <p className="text-sm font-medium text-neutral-800">
              {blocked ? 'Control Center blocked by review' : 'Control Center is being reviewed'}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {blocked
                ? 'Chat remains available. The last approved app can be restored by the Agent host.'
                : 'Chat remains available while this revision is checked.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 text-sm text-neutral-500" role="status">
          Loading Control Center…
        </div>
      )}
      <iframe
        ref={frameRef}
        title="Agent Control Center app"
        src={validated.url}
        allow={capabilityPolicy(validated.capabilities)}
        allowFullScreen={validated.capabilities?.includes('fullscreen')}
        referrerPolicy="no-referrer"
        onLoad={() => setLoadedRevision(validated.revision)}
        className="block h-full w-full border-0"
      />
    </div>
  )
}
