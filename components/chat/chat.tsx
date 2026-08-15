'use client'

import { useMemo, useCallback, useState } from 'react'
import { cn } from './utils'
import { ChatMessages } from './chat-messages'
import { ChatInput } from './chat-input'
import { ChatError } from './chat-error'
import { StatusBar } from './messages'
import { FullAccessMonitorPanel } from './full-access-monitor-panel'
import { FullAccessFullscreen } from './full-access-fullscreen'
import { bestOffers, UNIVERSAL_OPENER } from './skill-offers'
import type { ChatProps, ThinkingUI } from './types'

export function Chat({
  ui = [],
  onSend,
  onStop,
  isLoading = false,
  inputDisabled = false,
  placeholder = 'Send a message...',
  pendingAskUser,
  onAskUserResponse,
  pendingApproval,
  onApprovalResponse,
  pendingOnboard,
  onOnboardSubmit,
  pendingFullAccessCheckpoint,
  onFullAccessCheckpointResponse,
  pendingPlanReview,
  onPlanReviewResponse,
  className,
  statusBar,
  permissionProfile,
  fullAccessTurnsRemaining,
  onFullAccessStop,
  onFullAccessGoalSave,
  onFullAccessDirectionSave,
  fullAccessGoal = '',
  fullAccessDirection = '',
  sessionState,
  connectionError,
  onRetry,
  onDismissError,
  skills,
  acceptsAttachments,
  agentName,
}: ChatProps & { agentName?: string }) {
  const offers = useMemo(() => bestOffers(skills ?? []), [skills])
  // The Full access checkpoint counts too: an autonomous run has stopped and is asking
  // for more rope, which is the most consequential thing the composer can be
  // waiting on. Without it the placeholder still read "Send a message…" while
  // the run was parked.
  const awaitingYou = Boolean(pendingApproval || pendingAskUser || pendingFullAccessCheckpoint)
  const isFullAccessActive = permissionProfile === ':danger-full-access'
  const [fullAccessFullscreen, setFullAccessFullscreen] = useState(false)

  // Extract thinking items for StatusBar
  const thinkingItems = useMemo(
    () => ui.filter((item): item is ThinkingUI => item.type === 'thinking'),
    [ui]
  )

  // Handle send - if there's a pending ask_user, respond to it; otherwise send normally
  const handleSend = useCallback((content: string, images?: string[], files?: import('./types').FileAttachment[]) => {
    if (inputDisabled) return
    if (pendingAskUser && onAskUserResponse) {
      onAskUserResponse(content)
    } else {
      onSend(content, images, files)
    }
  }, [inputDisabled, pendingAskUser, onAskUserResponse, onSend])

  const inputPlaceholder = pendingAskUser
    ? 'Type your answer or select an option above...'
    : placeholder

  const handleFullAccessStop = useCallback(() => {
    setFullAccessFullscreen(false)
    onFullAccessStop?.()
  }, [onFullAccessStop])

  // Determine which bottom panel to show
  const renderBottom = () => {
    if (isFullAccessActive && onFullAccessStop) {
      return (
        <FullAccessMonitorPanel
          turnsRemaining={fullAccessTurnsRemaining ?? null}
          ui={ui}
          goal={fullAccessGoal}
          direction={fullAccessDirection}
          onGoalSave={onFullAccessGoalSave ?? (() => {})}
          onDirectionSave={onFullAccessDirectionSave ?? (() => {})}
          onStop={handleFullAccessStop}
          onExpand={() => setFullAccessFullscreen(true)}
        />
      )
    }

    return (
      <ChatInput
        onSend={handleSend}
        onStop={onStop}
        isLoading={isLoading}
        disabled={inputDisabled}
        placeholder={inputPlaceholder}
        statusBar={statusBar}
        skills={skills}
        acceptsAttachments={acceptsAttachments}
        // The composer is the one part of the page a reader always looks at, so it
        // is where "it is your move" has to be said. Everything else — the spinner,
        // the token counter, the status chip on the card — was either lying or
        // off-screen while the run sat blocked (#59).
        awaitingYou={awaitingYou}
        onJumpToPending={jumpToPending}
      />
    )
  }

  // The pending card is an ordinary transcript item and scrolls away like one.
  // Rather than thread a ref through ChatMessages, find it by the id the renderer
  // already puts on every item.
  const jumpToPending = useCallback(() => {
    const id = pendingApproval?.tool ?? pendingAskUser?.question
    if (!id) return
    document.querySelector('[data-pending-decision]')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [pendingApproval, pendingAskUser])

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
            <div className={`reveal mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-lg font-semibold text-white ${sessionState === 'active' || sessionState === 'connected' ? 'breathe-live' : ''}`}>
              {(agentName || 'A').charAt(0).toUpperCase()}
            </div>
            {agentName && <p className="reveal text-sm font-medium text-neutral-900" style={{ '--reveal-delay': '80ms' } as React.CSSProperties}>{agentName}</p>}
            <p className="reveal mt-1 text-sm text-neutral-500" style={{ '--reveal-delay': '140ms' } as React.CSSProperties}>
              {sessionState === 'active' || sessionState === 'connected'
                ? 'Connected — send a message'
                : 'Send a message to start'}
            </p>

            {/* The same three openers the landing page offers. This screen is what
                every visitor sees after passing a gate, and it used to ask them to
                think of something themselves in the first five seconds. Same chip
                markup as the landing page so there is one definition of a chip. */}
            <div
              className="reveal mt-6 flex flex-wrap justify-center gap-2 px-6"
              style={{ '--reveal-delay': '200ms' } as React.CSSProperties}
            >
              {/* The universal opener leads, filled — same as the landing page.
                  Outside the offers.length guard on purpose: an agent that
                  publishes no usable skill chips is exactly the one whose reader
                  has nothing to go on, and this row used to disappear entirely
                  for them. */}
              <button
                onClick={() => onSend(UNIVERSAL_OPENER)}
                disabled={inputDisabled}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:bg-neutral-800"
              >
                {UNIVERSAL_OPENER}
              </button>
              {offers.map(({ skill, offer }) => (
                  <button
                    key={skill.name}
                    onClick={() => onSend('/' + skill.name)}
                    disabled={inputDisabled}
                    className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-700 shadow-xs transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm active:translate-y-0"
                  >
                    {offer}
                  </button>
              ))}
            </div>
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
            onStop={onStop}
            onProviderMessage={(invocation, message) => onSend(
              `[Work Room → ${invocation.providerDisplayName}${invocation.sessionId ? ` session ${invocation.sessionId}` : ''}] ${message}`,
            )}
            pendingApproval={pendingApproval}
            onApprovalResponse={onApprovalResponse}
            pendingAskUser={pendingAskUser}
            onAskUserResponse={onAskUserResponse}
            pendingOnboard={pendingOnboard}
            onOnboardSubmit={onOnboardSubmit}
            pendingFullAccessCheckpoint={pendingFullAccessCheckpoint}
            onFullAccessCheckpointResponse={onFullAccessCheckpointResponse}
            pendingPlanReview={pendingPlanReview}
            onPlanReviewResponse={onPlanReviewResponse}
          />
        </>
      )}
      {/* Status bar between messages and input */}
      <StatusBar thinkingItems={thinkingItems} sessionState={sessionState} />

      {renderBottom()}

      {/* Fullscreen Full access overlay — portal-like, covers entire viewport */}
      {fullAccessFullscreen && isFullAccessActive && (
        <FullAccessFullscreen
          turnsRemaining={fullAccessTurnsRemaining ?? null}
          ui={ui}
          goal={fullAccessGoal}
          direction={fullAccessDirection}
          onGoalSave={onFullAccessGoalSave ?? (() => {})}
          onDirectionSave={onFullAccessDirectionSave ?? (() => {})}
          onStop={handleFullAccessStop}
          onCollapse={() => setFullAccessFullscreen(false)}
        />
      )}
    </div>
  )
}
