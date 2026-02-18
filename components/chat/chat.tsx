'use client'

import { useMemo, useCallback } from 'react'
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

  // Extract thinking items for StatusBar
  const thinkingItems = useMemo(
    () => ui.filter((item): item is ThinkingUI => item.type === 'thinking'),
    [ui]
  )

  // Handle send - if there's a pending ask_user, respond to it; otherwise send normally
  const handleSend = useCallback((content: string, images?: string[]) => {
    if (pendingAskUser && onAskUserResponse) {
      // Respond to ask_user with the typed message
      onAskUserResponse(content)
    } else {
      // Normal send
      onSend(content, images)
    }
  }, [pendingAskUser, onAskUserResponse, onSend])

  // Determine placeholder based on state
  const inputPlaceholder = pendingAskUser
    ? 'Type your answer or select an option above...'
    : placeholder

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
        onSend={handleSend}
        isLoading={isLoading}
        placeholder={inputPlaceholder}
        statusBar={statusBar}
      />
    </div>
  )
}
