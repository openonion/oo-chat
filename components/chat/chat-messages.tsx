'use client'

import { useEffect, useRef, useMemo, useState } from 'react'
import { pinToBottom } from './pin-to-bottom'
import { HiOutlineArrowDown } from 'react-icons/hi'
import { cn } from './utils'
import { User, Agent, Thinking, ToolCall, CodingAgentCard, AskUser, OnboardRequired, OnboardSuccess, Intent, Eval, Compact, ToolBlocked, FilesReceived } from './messages'
import { ChatAskUser } from './chat-ask-user'
import { ChatApproval } from './chat-approval'
import { ChatFullAccessCheckpoint } from './chat-full-access-checkpoint'
import type { ChatMessagesProps, OnboardRequiredUI, OnboardSuccessUI, IntentUI, EvalUI, CompactUI, ToolBlockedUI, FullAccessCheckpointUI, FilesReceivedUI, ProviderInvocationUI } from './types'

function approvalMatchesProvider(
  approval: ChatMessagesProps['pendingApproval'],
  invocation: { id: string; parentToolCallId: string; provider: string },
) {
  return Boolean(
    approval
    && approval.provider === invocation.provider
    && approval.providerInvocationId === invocation.id
    && approval.parentToolCallId === invocation.parentToolCallId,
  )
}

export function ChatMessages({
  ui = [],
  className,
  onProviderStop,
  onProviderInput,
  providerStopStates,
  pendingApproval,
  onApprovalResponse,
  pendingAskUser,
  onAskUserResponse,
  pendingOnboard,
  onOnboardSubmit,
  pendingFullAccessCheckpoint,
  onFullAccessCheckpointResponse,
  pendingPlanReview,
  onPlanReviewResponse,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const hasProviderStopAwaitingLifecycle = Boolean(providerStopStates?.size)
  const providerGroups = useMemo(() => {
    const groups = new Map<string, ProviderInvocationUI[]>()
    for (const item of ui) {
      if (item.type !== 'provider_invocation') continue
      const providerItem = item as ProviderInvocationUI
      const key = providerItem.workroomId || providerItem.id
      const group = groups.get(key) || []
      group.push(providerItem)
      groups.set(key, group)
    }
    const byInvocation = new Map<string, { root: ProviderInvocationUI, continuations: ProviderInvocationUI[] }>()
    for (const group of groups.values()) {
      const root = group.find(item => !item.continuationOf) || group[0]
      const continuations = group.filter(item => item.id !== root.id)
      for (const item of group) byInvocation.set(item.id, { root, continuations })
    }
    return byInvocation
  }, [ui])
  // Follow new content only while the user is at the bottom — never yank a reader
  // back down who scrolled up. Streamed tokens grow items in place (ui.length
  // unchanged), so we watch content height, not the item count.
  const stickToBottomRef = useRef(true)
  // Where the last pin left the scroll. A pin lands wherever the current
  // scrollHeight allows, and when the content is about to grow that is short of
  // the eventual bottom — 100px short, in the case #113 measured. The scroll
  // event it emits then looks exactly like the reader dragging away, so
  // handleScroll disengaged the stick and the pin never ran again.
  //
  // Compared by position rather than by a "we are scrolling" flag: a flag
  // swallows whatever event arrives next, and during streaming that is often the
  // reader's own wheel. CI caught exactly that — "the wheel gesture did not move
  // the transcript" — which would have traded #113 for a transcript you cannot
  // scroll back through at all.
  const pinnedTopRef = useRef(-1)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80

    // Only a gesture may disengage the stick, never our own pin: if the position
    // is exactly where the pin put it, this event is the pin's echo. But the
    // button is a display of where we are, not a decision about intent, so it
    // updates either way — returning early from the whole handler left a button
    // shown mid-stream still on screen after a pin had reached the bottom, with
    // nothing to go back to.
    const isPinEcho = Math.round(el.scrollTop) === pinnedTopRef.current
    if (!isPinEcho) stickToBottomRef.current = atBottom
    setShowScrollDown(!atBottom)
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    stickToBottomRef.current = true
    setShowScrollDown(false)
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    // Converge rather than guess a frame count — see pinToBottom, and #113 for
    // the measurement that showed one rAF is not enough.
    let queued: number | null = null
    const pin = () => {
      if (queued !== null) cancelAnimationFrame(queued)
      queued = pinToBottom(
        el,
        cb => requestAnimationFrame(cb),
        () => stickToBottomRef.current,
        { onPinned: top => { pinnedTopRef.current = top } },
      )
    }
    const observer = new ResizeObserver(pin)
    observer.observe(content)
    return () => {
      observer.disconnect()
      if (queued !== null) cancelAnimationFrame(queued)
    }
  }, [])

  // Find the last thinking item ID (for folding previous ones)
  const lastThinkingId = useMemo(() => {
    const thinkingItems = ui.filter(item => item.type === 'thinking')
    return thinkingItems[thinkingItems.length - 1]?.id
  }, [ui])

  // Find the last tool_call that matches the pending approval (by tool name)
  // Backend sends approval key as "bash:uname" format — match against base name before ":"
  const approvalToolName = pendingApproval?.tool.split(':')[0].toLowerCase()
  // `status === 'running'` matters: matching on name alone attaches the buttons to
  // whichever same-named call is last in the array, which after a second bash call
  // can be one that already finished. The approval then decorates a completed card
  // while the live one sits plain, and the reader answers about the wrong thing.
  const pendingToolId = pendingApproval && !pendingApproval.providerInvocationId
    ? ui.filter(item => item.type === 'tool_call'
        && item.name.toLowerCase() === approvalToolName
        && item.status === 'running')
        .pop()?.id
    : null

  // OIP permits a permission request without a preceding tool update.
  // Keep the existing inline tool-card treatment when that context exists;
  // otherwise the latest normalized approval item needs its own decision surface.
  const pendingStandaloneApprovalId = pendingApproval && !pendingToolId && !pendingApproval.providerInvocationId
    ? pendingApproval.id || ui.filter(item => item.type === 'approval_needed').pop()?.id
    : null

  // Find the last ask_user tool call that's still running
  const pendingAskUserToolId = pendingAskUser
    ? ui.filter(item => item.type === 'tool_call' && item.name.toLowerCase() === 'ask_user' && item.status === 'running')
        .pop()?.id
    : null

  const pendingStandaloneAskUserId = pendingAskUser && !pendingAskUserToolId
    ? ui.filter(item => item.type === 'ask_user' && !(item as { answered?: boolean }).answered)
        .pop()?.id
    : null

  // Most recent agent image (e.g. a QR screenshot) — shown in a QR sign-in modal
  let recentImage: string | undefined
  if (pendingAskUser) {
    for (let i = ui.length - 1; i >= 0; i--) {
      const it = ui[i]
      if (it.type === 'agent' && it.images?.length) { recentImage = it.images[0]; break }
    }
  }

  // Find the running exit_plan_and_implement tool call for plan review
  const pendingPlanToolId = pendingPlanReview
    ? ui.filter(item => item.type === 'tool_call' && item.name.toLowerCase() === 'exit_plan_and_implement' && item.status === 'running')
        .pop()?.id
    : null

  // Check if onboard was completed (has onboard_success event)
  const hasOnboardSuccess = ui.some(item => item.type === 'onboard_success')

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn('flex-1 overflow-y-auto overflow-x-hidden py-6 px-4', className)}
    >
      {/* Centered container with max-width matching input */}
      {/* The transcript is append-only, which is what role="log" describes, and
          polite so a reply does not interrupt what the reader is already hearing.
          Without it a screen-reader user sends a message and hears nothing back:
          not the reply, not "thinking", and not the approval card that has paused
          the run waiting on them. */}
      <div
        ref={contentRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Conversation"
        className="mx-auto max-w-3xl space-y-1"
      >
        {ui.map(item => {
          switch (item.type) {
            case 'user':
              return <User key={item.id} message={item} />
            case 'agent':
              return <Agent key={item.id} message={item} />
            case 'thinking':
              // A provider Stop without its terminal lifecycle frame is not an
              // active outer-agent turn. Hiding this generic spinner is safer
              // than showing a second, contradictory "working" signal.
              if (hasProviderStopAwaitingLifecycle && item.status === 'running') return null
              return <Thinking
                key={item.id}
                thinking={item}
                isLast={item.id === lastThinkingId}
                blocked={Boolean(pendingApproval || pendingAskUser)}
              />
            case 'tool_call': {
              // Pass approval info if this tool needs approval
              const needsApproval = item.id === pendingToolId
              const isAskUser = item.id === pendingAskUserToolId
              const isPlanReview = item.id === pendingPlanToolId
              // Marks whichever card is actually waiting on the reader, so the
              // composer's "Jump to it" can find it without threading a ref through
              // this list.
              const awaitsReader = needsApproval || isAskUser || isPlanReview
              return (
                <div key={item.id} {...(awaitsReader ? { 'data-pending-decision': '' } : {})}>
                <ToolCall
                  toolCall={item}
                  pendingApproval={needsApproval ? pendingApproval : undefined}
                  onApprovalResponse={needsApproval ? onApprovalResponse : undefined}
                  pendingAskUser={isAskUser ? pendingAskUser : undefined}
                  onAskUserResponse={isAskUser ? onAskUserResponse : undefined}
                  qrImage={isAskUser ? recentImage : undefined}
                  pendingPlanReview={isPlanReview ? pendingPlanReview : undefined}
                  onPlanReviewResponse={isPlanReview ? onPlanReviewResponse : undefined}
                />
                </div>
              )
            }
            case 'provider_invocation': {
              // Core emits an explicit OIP workroomId/continuationOf pair. Do
              // not infer grouping from array position or provider session IDs.
              const group = providerGroups.get(item.id)
              if (!group || group.root.id !== item.id) return null
              const current = group.continuations.at(-1) ?? item
              const approvalForProvider = approvalMatchesProvider(pendingApproval, current)
                ? pendingApproval
                : undefined
              const providerStopPhase = providerStopStates?.get(current.id)
              return (
                <div key={item.id} {...(approvalForProvider ? { 'data-pending-decision': '' } : {})}>
                  <CodingAgentCard
                    invocation={item}
                    continuations={group.continuations}
                    pendingApproval={approvalForProvider}
                    onApprovalResponse={approvalForProvider ? onApprovalResponse : undefined}
                    onProviderStop={onProviderStop}
                    onProviderInput={onProviderInput}
                    providerStopPhase={providerStopPhase}
                    providerStopLifecycleOwned={Boolean(providerStopStates)}
                  />
                </div>
              )
            }
            case 'ask_user':
              if (item.id === pendingStandaloneAskUserId && pendingAskUser && onAskUserResponse) {
                return (
                  <ChatAskUser
                    key={item.id}
                    askUser={pendingAskUser}
                    onResponse={onAskUserResponse}
                  />
                )
              }
              return <AskUser key={item.id} question={item} />
            case 'approval_needed':
              if (
                item.id === pendingStandaloneApprovalId
                && pendingApproval
                && onApprovalResponse
              ) {
                return (
                  <div key={item.id} data-pending-decision="">
                    <ChatApproval
                      approval={pendingApproval}
                      onResponse={onApprovalResponse}
                    />
                  </div>
                )
              }
              // A matching running tool card owns the inline decision controls.
              return null
            case 'plan_review':
              // Rendered inline via tool card (exit_plan_and_implement)
              return null
            case 'onboard_required': {
              // Only show interactive form if this is the pending onboard
              const isPending = pendingOnboard !== null
              return (
                <OnboardRequired
                  key={item.id}
                  data={item as OnboardRequiredUI}
                  onSubmit={isPending && onOnboardSubmit ? onOnboardSubmit : () => {}}
                  isCompleted={hasOnboardSuccess}
                />
              )
            }
            case 'onboard_success':
              return <OnboardSuccess key={item.id} data={item as OnboardSuccessUI} />
            case 'intent':
              return <Intent key={item.id} intent={item as IntentUI} />
            case 'eval':
              return <Eval key={item.id} eval={item as EvalUI} />
            case 'compact':
              return <Compact key={item.id} compact={item as CompactUI} />
            case 'tool_blocked':
              return <ToolBlocked key={item.id} data={item as ToolBlockedUI} />
            case 'files_received':
              return <FilesReceived key={item.id} data={item as FilesReceivedUI} />
            case 'full_access_checkpoint': {
              const isPending = pendingFullAccessCheckpoint !== null
              return isPending && onFullAccessCheckpointResponse ? (
                <ChatFullAccessCheckpoint
                  key={item.id}
                  checkpoint={item as FullAccessCheckpointUI}
                  onResponse={onFullAccessCheckpointResponse}
                />
              ) : null
            }
          }
        })}
      </div>
    </div>

    {/* Quick scroll-to-bottom — shown while the user is scrolled up */}
    {showScrollDown && (
      <button
        onClick={scrollToBottom}
        aria-label="Scroll to bottom"
        className="absolute bottom-4 left-1/2 -translate-x-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-md text-neutral-500 hover:text-neutral-900 hover:shadow-lg transition-all"
      >
        <HiOutlineArrowDown className="h-4 w-4" />
      </button>
    )}
    </div>
  )
}
