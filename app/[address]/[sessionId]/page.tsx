'use client'

import { useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Chat, useAgentSDK, ModeStatusBar, PlanModeBanner, UlwModeBanner } from '@/components/chat'
import type { UI, ApprovalMode } from '@/components/chat/types'
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
  const searchParams = useSearchParams()
  const address = params.address as string
  const sessionId = params.sessionId as string

  // Read initial mode from URL (stateless, simple)
  const initialMode = (searchParams.get('mode') as ApprovalMode) || 'safe'
  const initialTurns = searchParams.get('turns') ? parseInt(searchParams.get('turns')!) : null

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
    pendingUlwTurnsReached,
    mode,
    ulwTurnsRemaining,
    send,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    respondToUlwTurnsReached,
    setMode,
  } = useAgentSDK({
    agentAddress: address,
    sessionId,
  })

  // Consume pending message and apply initial mode from URL
  const consumedRef = useRef<string | null>(null)

  useEffect(() => {
    if (consumedRef.current === sessionId) return
    consumedRef.current = sessionId

    // Apply mode from URL FIRST (before sending message)
    if (initialMode !== 'safe') {
      setMode(initialMode, initialTurns ? { turns: initialTurns } : undefined)
    }

    // Then send the pending message
    const pendingMessage = consumePendingMessage()
    if (pendingMessage) {
      send(pendingMessage)
    }
  }, [sessionId, initialMode, initialTurns, consumePendingMessage, send, setMode])

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

  const handleSend = useCallback(async (content: string, images?: string[]) => {
    if (!conversation) {
      createConversation(sessionId, address)
    }
    await send(content, images)
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
  const isUlwActive = mode === 'ulw'

  return (
    <ChatLayout>
      <div className="flex flex-col flex-1 min-h-0 relative">
        {/* Plan mode banner */}
        {mode === 'plan' && (
          <PlanModeBanner onExit={() => setMode('safe')} />
        )}

        {/* ULW mode banner */}
        {isUlwActive && (
          <UlwModeBanner turnsRemaining={ulwTurnsRemaining} onExit={() => setMode('safe')} />
        )}

        {/* Chat with mode status bar (ULW toggle integrated) */}
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
          pendingUlwTurnsReached={pendingUlwTurnsReached}
          onUlwTurnsReachedResponse={respondToUlwTurnsReached}
          statusBar={<ModeStatusBar mode={mode} onModeChange={setMode} disabled={false} ulwTurnsRemaining={ulwTurnsRemaining} />}
        />
      </div>
    </ChatLayout>
  )
}
