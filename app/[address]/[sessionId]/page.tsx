'use client'

import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chat, useAgentSDK } from '@/components/chat'
import type { UI } from '@/components/chat/types'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { shortAddress } from '@/hooks/use-agent-info'

const SUGGESTIONS = [
  'I want to create an agent in /tmp folder which is about an agent to clean duplicated files.',
  'List files in /tmp, current folder, and ~/. Use three separate bash tool calls running in parallel, do NOT combine them into a single command.',
  'Show system info',
]

export default function ChatSessionPage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string
  const sessionId = params.sessionId as string

  const {
    agents,
    addAgent,
    conversations,
    createConversation,
    selectConversation,
    updateTitle,
    updateUI,
    consumePendingMessage,
  } = useChatStore()

  useIdentity()

  // Add agent if not in list
  useEffect(() => {
    if (address && !agents.includes(address)) {
      addAgent(address)
    }
  }, [address, agents, addAgent])

  // Find the conversation
  const conversation = useMemo(
    () => conversations.find(c => c.sessionId === sessionId),
    [conversations, sessionId]
  )

  // Set active session when route changes
  useEffect(() => {
    if (sessionId) {
      selectConversation(sessionId)
    }
  }, [sessionId, selectConversation])

  const {
    ui: hookUI,
    isLoading,
    elapsedTime,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    send,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    clear,
  } = useAgentSDK({
    agentAddress: address,
  })

  // Reset SDK state when session changes
  const prevSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      clear()
    }
    prevSessionIdRef.current = sessionId
  }, [sessionId, clear])

  // Consume pending message from new chat creation
  const consumedRef = useRef<string | null>(null)
  useEffect(() => {
    if (consumedRef.current === sessionId) return
    consumedRef.current = sessionId
    const pendingMessage = consumePendingMessage()
    if (pendingMessage) {
      send(pendingMessage)
    }
  }, [sessionId, consumePendingMessage, send])

  // Use stored UI if available, otherwise use hook UI
  const displayUI = useMemo((): UI[] => {
    if (hookUI.length > 0) {
      return hookUI as UI[]
    }
    return conversation?.ui || []
  }, [hookUI, conversation?.ui])

  // Sync UI changes back to store
  useEffect(() => {
    if (sessionId && hookUI.length > 0) {
      updateUI(sessionId, hookUI as UI[])

      const firstUser = hookUI.find(e => e.type === 'user')
      if (firstUser && 'content' in firstUser) {
        updateTitle(sessionId, firstUser.content)
      }
    }
  }, [sessionId, hookUI, updateUI, updateTitle])

  const handleSend = useCallback(async (content: string) => {
    if (!conversation) {
      createConversation(sessionId, address)
    }
    await send(content)
  }, [conversation, sessionId, address, createConversation, send])

  // Redirect to agent landing if no conversation and no pending messages
  const shouldRedirect = !conversation && hookUI.length === 0
  useEffect(() => {
    if (shouldRedirect) {
      router.replace(`/${address}`)
    }
  }, [shouldRedirect, router, address])

  if (shouldRedirect) {
    return null
  }

  const agentLabel = shortAddress(address)

  return (
    <ChatLayout>
      <Chat
        ui={displayUI}
        onSend={handleSend}
        isLoading={isLoading}
        elapsedTime={elapsedTime}
        suggestions={SUGGESTIONS}
        emptyStateTitle="Welcome to oo-chat"
        emptyStateDescription={`Talking to ${agentLabel}`}
        pendingAskUser={pendingAskUser}
        onAskUserResponse={respondToAskUser}
        pendingApproval={pendingApproval}
        onApprovalResponse={respondToApproval}
        pendingOnboard={pendingOnboard}
        onOnboardSubmit={submitOnboard}
      />
    </ChatLayout>
  )
}
