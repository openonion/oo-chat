'use client'

import { useMemo, useCallback, useState } from 'react'
import { cn } from './utils'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { ChatError } from './chat-error'
import { StatusBar } from './messages'
import { UlwSetupPanel } from './ulw-setup-panel'
import { UlwMonitorPanel } from './ulw-monitor-panel'
import { UlwFullscreen } from './ulw-fullscreen'
import type { ChatProps, ThinkingUI, UserUI } from './types'

export function Chat({
  ui = [],
  onSend,
  onStop,
  isLoading = false,
  placeholder = 'Send a message...',
  pendingAskUser,
  onAskUserResponse,
  pendingApproval,
  onApprovalResponse,
  pendingOnboard,
  onOnboardSubmit,
  pendingUlwTurnsReached,
  onUlwTurnsReachedResponse,
  pendingPlanReview,
  onPlanReviewResponse,
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
  sessionState,
  connectionError,
  onRetry,
  onDismissError,
  hasSession,
  onReconnect,
  skills,
  agentName,
}: ChatProps & { agentName?: string }) {
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
  const handleSend = useCallback((content: string, images?: string[], files?: import('./types').FileAttachment[]) => {
    if (pendingAskUser && onAskUserResponse) {
      onAskUserResponse(content)
    } else {
      onSend(content, images, files)
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
        onStop={onStop}
        isLoading={isLoading}
        placeholder={inputPlaceholder}
        statusBar={statusBar}
        skills={skills}
      />
    )
  }

  const isEmpty = ui.length === 0

  return (
    <div className={cn('flex h-full flex-col bg-white', className)}>
      {isEmpty && !connectionError && (isLoading || sessionState === 'reconnecting') ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 animate-pulse" />
            <span>Connecting to agent…</span>
          </div>
        </div>
      ) : isEmpty && !connectionError ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white">
              {(agentName || 'A').charAt(0).toUpperCase()}
            </div>
            {agentName && <p className="text-sm font-medium text-neutral-900">{agentName}</p>}
            <p className="mt-1 text-sm text-neutral-400">
              {sessionState === 'active' || sessionState === 'connected'
                ? 'Connected — send a message'
                : 'Send a message to start'}
            </p>
          </div>
        </div>
      ) : (
        <>
          {connectionError && (
            <div className="p-4">
              <ChatError
                error={connectionError}
                onRetry={onRetry}
                onDismiss={onDismissError}
              />
            </div>
          )}
          <ChatMessages
            ui={ui}
            isLoading={isLoading}
            pendingApproval={pendingApproval}
            onApprovalResponse={onApprovalResponse}
            pendingAskUser={pendingAskUser}
            onAskUserResponse={onAskUserResponse}
            pendingOnboard={pendingOnboard}
            onOnboardSubmit={onOnboardSubmit}
            pendingUlwTurnsReached={pendingUlwTurnsReached}
            onUlwTurnsReachedResponse={onUlwTurnsReachedResponse}
            pendingPlanReview={pendingPlanReview}
            onPlanReviewResponse={onPlanReviewResponse}
          />
        </>
      )}
      {/* Status bar between messages and input */}
      <StatusBar thinkingItems={thinkingItems} sessionState={sessionState} />

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
