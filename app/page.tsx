'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Chat, useAgentSDK } from '@/components/chat'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'

const SUGGESTIONS = [
  'I want to create an agent in /tmp folder which is about an agent to clean duplicated files.',
  'List files in /tmp, current folder, and ~/. Use three separate bash tool calls running in parallel, do NOT combine them into a single command.',
  'Show system info',
]

export default function Home() {
  const router = useRouter()
  const {
    defaultAgentUrl,
    defaultAgentAddress,
    createConversation,
    clearActive,
    setPendingMessage,
  } = useChatStore()

  // Initialize identity (handles auth in background)
  useIdentity()

  // Clear active session on mount (this is new chat view)
  useEffect(() => {
    clearActive()
  }, [clearActive])

  const {
    ui,
    isLoading,
    elapsedTime,
    pendingAskUser,
    pendingApproval,
    pendingOnboard,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    clear,
  } = useAgentSDK({
    agentUrl: defaultAgentUrl,
  })

  // Reset SDK state on mount so home page always shows empty state
  useEffect(() => {
    clear()
  }, [clear])

  const handleSend = useCallback(async (content: string) => {
    // Create new session
    const sessionId = crypto.randomUUID()
    createConversation(sessionId, defaultAgentAddress || 'local', defaultAgentUrl)

    // Store the pending message for the session page to pick up
    setPendingMessage(content)

    // Navigate to the new session
    router.push(`/chat/${sessionId}`)
  }, [defaultAgentAddress, defaultAgentUrl, createConversation, setPendingMessage, router])

  return (
    <ChatLayout>
      <Chat
        ui={ui}
        onSend={handleSend}
        isLoading={isLoading}
        elapsedTime={elapsedTime}
        suggestions={SUGGESTIONS}
        emptyStateTitle="Welcome to oo-chat"
        emptyStateDescription={`Connected to agent at ${defaultAgentUrl.replace('https://', '').split('.')[0]}`}
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
