'use client'

import { useMemo, useCallback, useState } from 'react'
import { cn } from './utils'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { ChatEmptyState } from './chat-empty-state'
import { StatusBar } from './messages'
import { UlwSetupPanel } from './ulw-setup-panel'
import { UlwMonitorPanel } from './ulw-monitor-panel'
import { UlwFullscreen } from './ulw-fullscreen'
import type { ChatProps, ThinkingUI, UserUI } from './types'

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
  mode,
  ulwTurnsRemaining,
  ulwSetupActive,
  onUlwStart,
  onUlwStop,
  onUlwSetupCancel,
  onUlwGoalSave,
  onUlwDirectionSave,
  ulwGoal = '',
  ulwDirection = '',
}: ChatProps) {
  const isEmpty = ui.length === 0
  const isUlwActive = mode === 'ulw'
  const [ulwFullscreen, setUlwFullscreen] = useState(false)

  // Extract thinking items for StatusBar
  const thinkingItems = useMemo(
    () => ui.filter((item): item is ThinkingUI => item.type === 'thinking'),
    [ui]
  )

  // Pre-fill goal from last user message
  const lastUserMessage = useMemo(() => {
    for (let i = ui.length - 1; i >= 0; i--) {
      if (ui[i].type === 'user') return (ui[i] as UserUI).content
    }
    return ''
  }, [ui])

  // Handle send - if there's a pending ask_user, respond to it; otherwise send normally
  const handleSend = useCallback((content: string, images?: string[]) => {
    if (pendingAskUser && onAskUserResponse) {
      onAskUserResponse(content)
    } else {
      onSend(content, images)
    }
  }, [pendingAskUser, onAskUserResponse, onSend])

  const inputPlaceholder = pendingAskUser
    ? 'Type your answer or select an option above...'
    : placeholder

  const handleUlwStop = useCallback(() => {
    setUlwFullscreen(false)
    onUlwStop?.()
  }, [onUlwStop])

  // Determine which bottom panel to show
  const renderBottom = () => {
    if (isUlwActive && onUlwStop) {
      return (
        <UlwMonitorPanel
          turnsRemaining={ulwTurnsRemaining ?? null}
          ui={ui}
          goal={ulwGoal}
          direction={ulwDirection}
          onGoalSave={onUlwGoalSave ?? (() => {})}
          onDirectionSave={onUlwDirectionSave ?? (() => {})}
          onStop={handleUlwStop}
          onExpand={() => setUlwFullscreen(true)}
        />
      )
    }

    if (ulwSetupActive && onUlwStart && onUlwSetupCancel) {
      return (
        <UlwSetupPanel
          initialGoal={ulwGoal || lastUserMessage}
          onStart={onUlwStart}
          onCancel={onUlwSetupCancel}
        />
      )
    }

    return (
      <ChatInput
        onSend={handleSend}
        isLoading={isLoading}
        placeholder={inputPlaceholder}
        statusBar={statusBar}
      />
    )
  }

  return (
    <div className={cn('flex h-full flex-col bg-white dark:bg-neutral-950', className)}>
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
      {renderBottom()}

      {/* Fullscreen ULW overlay — portal-like, covers entire viewport */}
      {ulwFullscreen && isUlwActive && (
        <UlwFullscreen
          turnsRemaining={ulwTurnsRemaining ?? null}
          ui={ui}
          goal={ulwGoal}
          direction={ulwDirection}
          onGoalSave={onUlwGoalSave ?? (() => {})}
          onDirectionSave={onUlwDirectionSave ?? (() => {})}
          onStop={handleUlwStop}
          onCollapse={() => setUlwFullscreen(false)}
        />
      )}
    </div>
  )
}
