'use client'

import { useMemo } from 'react'
import { cn } from './utils'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { ChatEmptyState } from './chat-empty-state'
import { StatusBar } from './messages'
import type { ChatProps, ThinkingUI } from './types'

const DEFAULT_SUGGESTIONS = [
  'Explain how this works',
  'Write some example code',
  'Help me debug an issue',
]

export function Chat({
  ui = [],
  onSend,
  isLoading = false,
  placeholder = 'Send a message...',
  emptyStateTitle,
  emptyStateDescription,
  suggestions = DEFAULT_SUGGESTIONS,
  elapsedTime = 0,
  pendingAskUser,
  onAskUserResponse,
  pendingApproval,
  onApprovalResponse,
  pendingOnboard,
  onOnboardSubmit,
  pendingUlwTurnsReached,
  onUlwTurnsReachedResponse,
  className,
  statusBar,
}: ChatProps) {
  const isEmpty = ui.length === 0
  const isWaitingForUser = !!pendingAskUser || !!pendingApproval || !!pendingOnboard || !!pendingUlwTurnsReached

  // Extract thinking items for StatusBar
  const thinkingItems = useMemo(
    () => ui.filter((item): item is ThinkingUI => item.type === 'thinking'),
    [ui]
  )

  return (
    <div className={cn('flex h-full flex-col bg-white', className)}>
      {isEmpty ? (
        <ChatEmptyState
          title={emptyStateTitle}
          description={emptyStateDescription}
          suggestions={suggestions}
          onSuggestionClick={onSend}
        />
      ) : (
        <ChatMessages
          ui={ui}
          elapsedTime={elapsedTime}
          isLoading={isLoading}
          pendingApproval={pendingApproval}
          onApprovalResponse={onApprovalResponse}
          pendingAskUser={pendingAskUser}
          onAskUserResponse={onAskUserResponse}
          pendingOnboard={pendingOnboard}
          onOnboardSubmit={onOnboardSubmit}
          pendingUlwTurnsReached={pendingUlwTurnsReached}
          onUlwTurnsReachedResponse={onUlwTurnsReachedResponse}
        />
      )}
      {/* Status bar between messages and input */}
      <StatusBar thinkingItems={thinkingItems} />
      <ChatInput
        onSend={onSend}
        isLoading={isLoading || isWaitingForUser}
        placeholder={isWaitingForUser ? 'Waiting for your response above...' : placeholder}
        statusBar={statusBar}
      />
    </div>
  )
}
