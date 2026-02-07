'use client'

import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Chat, useAgentSDK } from '@/components/chat'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'

const SUGGESTIONS = [
  'I want to create an agent in /tmp folder which is about an agent to clean duplicated files.',
  'List files in /tmp, current folder, and ~/. Use three separate bash tool calls running in parallel, do NOT combine them into a single command.',
  'Show system info',
]

export default function ChatSessionPage() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params.sessionId as string

  const {
    conversations,
    defaultAgentUrl,
    createConversation,
    selectConversation,
    updateTitle,
    updateUI,
    consumePendingMessage,
  } = useChatStore()

  // Initialize identity (handles auth in background)
  useIdentity()

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

  const agentUrl = conversation?.agentUrl || defaultAgentUrl

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
    agentUrl,
  })

  // Reset hook when switching sessions
  const prevSessionIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== sessionId) {
      clear()
    }
    prevSessionIdRef.current = sessionId
  }, [sessionId, clear])

  // Consume pending message from new chat creation (only once per session)
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
  // When user sends a new message in an existing session, hook UI will update
  const displayUI = useMemo(() => {
    // If hook has new messages (user started chatting), use hook UI
    if (hookUI.length > 0) {
      return hookUI
    }
    // Otherwise show stored conversation UI
    return conversation?.ui || []
  }, [hookUI, conversation?.ui])

  // Sync UI changes back to store when hook UI updates
  useEffect(() => {
    if (sessionId && hookUI.length > 0) {
      updateUI(sessionId, hookUI)

      const firstUser = hookUI.find(e => e.type === 'user')
      if (firstUser && 'content' in firstUser) {
        updateTitle(sessionId, firstUser.content)
      }
    }
  }, [sessionId, hookUI, updateUI, updateTitle])

  const handleSend = useCallback(async (content: string) => {
    // If conversation doesn't exist, create it
    if (!conversation) {
      createConversation(sessionId, 'local', defaultAgentUrl)
    }
    await send(content)
  }, [conversation, sessionId, defaultAgentUrl, createConversation, send])

  // If conversation not found and no hook UI, redirect to home
  useEffect(() => {
    if (!conversation && hookUI.length === 0) {
      router.replace('/')
    }
  }, [conversation, hookUI.length, router])

  if (!conversation && hookUI.length === 0) {
    return null
  }

  return (
    <ChatLayout agentUrl={agentUrl}>
      <Chat
        ui={displayUI}
        onSend={handleSend}
        isLoading={isLoading}
        elapsedTime={elapsedTime}
        suggestions={SUGGESTIONS}
        emptyStateTitle="Welcome to oo-chat"
        emptyStateDescription={`Connected to agent at ${agentUrl.replace('https://', '').split('.')[0]}`}
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
