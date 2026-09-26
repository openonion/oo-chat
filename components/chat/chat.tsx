'use client'

import { useMemo, useCallback, useState } from 'react'
import Link from 'next/link'
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
  headerActions,
  taskStatus,
  ui = [],
  onSend,
  onStop,
  onProviderStop,
  onProviderInput,
  onProviderPermission,
  providerStopStates,
  isLoading = false,
  inputDisabled = false,
  hideComposer = false,
  placeholder = 'Send a message...',
  disabledPlaceholder,
  pendingAskUser,
  onAskUserResponse,
  pendingApproval,
  onApprovalResponse,
  pendingOnboard,
  onOnboardSubmit,
  className,
  statusBar,
  mode,
  turnsLeft,
  onFullAccessStop,
  onFullAccessGoalSave,
  onFullAccessDirectionSave,
  fullAccessGoal = '',
  fullAccessDirection = '',
  sessionState,
  connectionError,
  onRetry,
  onReconnect,
  onDismissError,
  skills,
  acceptsAttachments,
  agentName,
  agentAddress,
  sessionTitle,
}: ChatProps & { agentName?: string; agentAddress?: string; sessionTitle?: string }) {
  const offers = useMemo(() => bestOffers(skills ?? []), [skills])
  const awaitingYou = Boolean(pendingApproval || pendingAskUser)
  // A native provider Stop has an acknowledged request but no authoritative
  // terminal lifecycle state yet. The outer agent's generic Stop would target
  // something else and falsely imply that this provider is still working.
  const hasProviderStopAwaitingLifecycle = Boolean(providerStopStates?.size)
  const isFullAccessActive = mode === 'full-access'
  const [fullAccessFullscreen, setFullAccessFullscreen] = useState(false)

  // Extract thinking items for StatusBar
  const thinkingItems = useMemo(
    () => hasProviderStopAwaitingLifecycle
      ? []
      : ui.filter((item): item is ThinkingUI => item.type === 'thinking'),
    [ui, hasProviderStopAwaitingLifecycle]
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
    if (hasProviderStopAwaitingLifecycle) return
    setFullAccessFullscreen(false)
    onFullAccessStop?.()
  }, [hasProviderStopAwaitingLifecycle, onFullAccessStop])

  // Determine which bottom panel to show
  const renderBottom = () => {
    if (isFullAccessActive && onFullAccessStop) {
      return (
        <FullAccessMonitorPanel
          turnsRemaining={turnsLeft ?? null}
          ui={ui}
          goal={fullAccessGoal}
          direction={fullAccessDirection}
          onGoalSave={onFullAccessGoalSave ?? (() => {})}
          onDirectionSave={onFullAccessDirectionSave ?? (() => {})}
          onStop={hasProviderStopAwaitingLifecycle ? undefined : handleFullAccessStop}
          onExpand={() => setFullAccessFullscreen(true)}
          providerStateUnconfirmed={hasProviderStopAwaitingLifecycle}
        />
      )
    }

    return (
      <ChatInput
        onSend={handleSend}
        onStop={hasProviderStopAwaitingLifecycle ? undefined : onStop}
        isLoading={isLoading}
        disabled={inputDisabled}
        placeholder={inputPlaceholder}
        disabledPlaceholder={disabledPlaceholder}
        statusBar={statusBar}
        skills={skills}
        acceptsAttachments={acceptsAttachments}
        // The composer is the one part of the page a reader always looks at, so it
        // is where "it is your move" has to be said. Everything else — the spinner,
        // the token counter, the status chip on the card — was either lying or
        // off-screen while the run sat blocked (#59).
        awaitingYou={awaitingYou}
        pendingDecisionKind={pendingApproval ? 'approval' : pendingAskUser ? 'question' : undefined}
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
    <div className={cn('flex min-h-0 flex-1 flex-col bg-white', className)}>
      {agentAddress && (
        <header className="hidden min-h-16 shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-6 lg:flex">
          <div className="flex min-w-0 items-center gap-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-identity-50 text-sm font-semibold text-identity-800 ring-1 ring-identity-100">
              {(agentName || 'A').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <Link href={`/${agentAddress}`} className="block truncate text-sm font-semibold text-neutral-900 hover:underline hover:underline-offset-2">
                {agentName || 'Agent'}
              </Link>
              <p className="truncate text-xs text-neutral-600">{sessionTitle || 'New conversation'}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
          {headerActions}
          <Link href={`/${agentAddress}`} className="shrink-0 rounded-lg border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">
            New chat
          </Link>
          </div>
        </header>
      )}
      {taskStatus}
      {isEmpty && !connectionError && (isLoading || sessionState === 'reconnecting') ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 animate-pulse" />
            <span>Connecting to agent…</span>
          </div>
        </div>
      ) : isEmpty && !connectionError ? (
        <div className="flex flex-1 items-start justify-center px-5 pb-10 pt-16 sm:items-center sm:py-10">
          <div className="w-full max-w-lg">
            {agentName && <p className="text-sm font-semibold text-neutral-600">Working with {agentName}</p>}
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
              What would you like to work on?
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              {sessionState === 'active' || sessionState === 'connected'
                ? 'Connected — choose a starting point or write your own message below.'
                : 'Choose a starting point or send a message to start.'}
            </p>

            {/* The same three openers the landing page offers. This screen is what
                every visitor sees after passing a gate, and it used to ask them to
                think of something themselves in the first five seconds. Same chip
                markup as the landing page so there is one definition of a chip. */}
            <div className="mt-8 grid gap-2">
              {/* The universal opener leads, filled — same as the landing page.
                  Outside the offers.length guard on purpose: an agent that
                  publishes no usable skill chips is exactly the one whose reader
                  has nothing to go on, and this row used to disappear entirely
                  for them. */}
              <button
                onClick={() => onSend(UNIVERSAL_OPENER)}
                disabled={inputDisabled}
                className="min-h-12 rounded-lg bg-neutral-900 px-4 py-3 text-left text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-identity-700 focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {UNIVERSAL_OPENER}
              </button>
              {offers.map(({ skill, offer }) => (
                  <button
                    key={skill.name}
                    onClick={() => onSend('/' + skill.name)}
                    disabled={inputDisabled}
                    className="min-h-12 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left text-sm font-medium text-neutral-800 transition-colors hover:border-neutral-400 hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-identity-700 focus-visible:ring-offset-2 disabled:opacity-50"
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
                onReconnect={onReconnect}
                onDismiss={onDismissError}
              />
            </div>
          )}
          <ChatMessages
            footer={<StatusBar thinkingItems={thinkingItems} sessionState={sessionState} />}
            ui={ui}
            agentName={agentName}
            agentAddress={agentAddress}
            isLoading={isLoading}
            onProviderStop={onProviderStop}
            onProviderInput={onProviderInput}
            onProviderPermission={onProviderPermission}
            providerStopStates={providerStopStates}
            pendingApproval={pendingApproval}
            onApprovalResponse={onApprovalResponse}
            pendingAskUser={pendingAskUser}
            onAskUserResponse={onAskUserResponse}
            pendingOnboard={pendingOnboard}
            onOnboardSubmit={onOnboardSubmit}
          />
        </>
      )}
      {!hideComposer && renderBottom()}

      {/* This remains inactive until a Host wires the Full access monitor's
          turn, goal, and direction contract. It still shares Stop safety when
          a supported consumer supplies that contract. */}
      {fullAccessFullscreen && isFullAccessActive && (
        <FullAccessFullscreen
          turnsRemaining={turnsLeft ?? null}
          ui={ui}
          goal={fullAccessGoal}
          direction={fullAccessDirection}
          onGoalSave={onFullAccessGoalSave ?? (() => {})}
          onDirectionSave={onFullAccessDirectionSave ?? (() => {})}
          onStop={hasProviderStopAwaitingLifecycle ? undefined : handleFullAccessStop}
          onCollapse={() => setFullAccessFullscreen(false)}
          providerStateUnconfirmed={hasProviderStopAwaitingLifecycle}
        />
      )}

    </div>
  )
}
