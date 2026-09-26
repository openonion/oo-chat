'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useMemo, useState } from 'react'
import { completedActivityGroups } from './completed-activity'
import { pinToBottom } from './pin-to-bottom'
import { HiOutlineArrowDown } from 'react-icons/hi'
import { cn } from './utils'
import { User, Agent, Thinking, ToolCall, CodingAgentCard, AskUser, AnsweredElsewhere, OnboardRequired, OnboardSuccess, Intent, Eval, Compact, ToolBlocked, FilesReceived } from './messages'
import { ChatAskUser } from './chat-ask-user'
import { ChatApproval } from './chat-approval'
import type { UI, ChatMessagesProps, OnboardRequiredUI, OnboardSuccessUI, IntentUI, EvalUI, CompactUI, ToolBlockedUI, FilesReceivedUI, ProviderInvocationUI } from './types'

function CompletedActivity({ activity, initiallyExpanded }: { activity: UI[]; initiallyExpanded: boolean }) {
  // If the reader is examining the log as work completes, keep it open. The
  // disclosure retains that choice through subsequent message updates.
  const [expanded, setExpanded] = useState(initiallyExpanded)
  return <details open={expanded} onToggle={event => setExpanded(event.currentTarget.open)} className="group py-2 text-sm text-neutral-500">
    <summary className="w-fit cursor-pointer rounded py-2 focus-visible:outline-2 focus-visible:outline-neutral-900">
      {activity.filter(step => step.type === 'tool_call').length} completed steps · View activity
    </summary>
    <div className="mt-2 border-l border-neutral-200 pl-3">
      {activity.map(step => step.type === 'tool_call'
        ? <ToolCall key={step.id} toolCall={step} />
        : step.type === 'thinking' ? <Thinking key={step.id} thinking={step} /> : null)}
    </div>
  </details>
}

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
  footer,
  ui = [],
  agentName,
  agentAddress,
  className,
  onProviderStop,
  onProviderInput,
  onProviderPermission,
  providerStopStates,
  pendingApproval,
  onApprovalResponse,
  pendingAskUser,
  onAskUserResponse,
  pendingOnboard,
  onOnboardSubmit,
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
  const pendingResultAnchorRef = useRef<string | null>(null)
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

  const anchorCompletedResult = useCallback(() => {
    const id = pendingResultAnchorRef.current
    const el = scrollRef.current
    if (!id || !el) return false
    if (!stickToBottomRef.current) {
      pendingResultAnchorRef.current = null
      return false
    }
    const result = Array.from(contentRef.current?.querySelectorAll<HTMLElement>('[data-completed-result]') ?? [])
      .find(node => node.dataset.completedResult === id)
    if (!result || result.offsetHeight <= el.clientHeight - 32) return false
    pendingResultAnchorRef.current = null
    stickToBottomRef.current = false
    el.scrollTop = Math.max(0, el.scrollTop + result.getBoundingClientRect().top - el.getBoundingClientRect().top - 16)
    pinnedTopRef.current = Math.round(el.scrollTop)
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight >= 80)
    return true
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return
    // Converge rather than guess a frame count — see pinToBottom, and #113 for
    // the measurement that showed one rAF is not enough.
    let queued: number | null = null
    const pin = () => {
      if (queued !== null) cancelAnimationFrame(queued)
      if (anchorCompletedResult()) return
      queued = pinToBottom(
        el,
        cb => requestAnimationFrame(cb),
        () => stickToBottomRef.current,
        { onPinned: top => { pinnedTopRef.current = top } },
      )
    }
    const observer = new ResizeObserver(pin)
    observer.observe(content)
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (queued !== null) cancelAnimationFrame(queued)
    }
  }, [anchorCompletedResult])

  const latestUserId = ui.findLast(item => item.type === 'user')?.id
  useLayoutEffect(() => {
    stickToBottomRef.current = true
    pendingResultAnchorRef.current = null
  }, [latestUserId])

  const completedActivity = useMemo(() => completedActivityGroups(ui), [ui])
  const latestCompletedResultId = ui.findLast(item => completedActivity.resultIds.has(item.id))?.id

  useLayoutEffect(() => {
    // Finishing a tool run replaces a tall log with one disclosure. For a long
    // result, preserve its beginning as the reading position instead of pinning
    // to metadata below it. Short results continue to fit at the bottom, and a
    // reader already inspecting older messages is never moved. The observer
    // also handles a reply that first arrives short and grows under the same ID.
    pendingResultAnchorRef.current = latestCompletedResultId ?? null
    anchorCompletedResult()
  }, [latestCompletedResultId, anchorCompletedResult])

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

  // Check if onboard was completed (has onboard_success event)
  const hasOnboardSuccess = ui.some(item => item.type === 'onboard_success')

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      className={cn('flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-6', className)}
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
        className="mx-auto max-w-3xl space-y-2"
      >
        {ui.map(item => {
          if (completedActivity.hidden.has(item.id)) return null
          const activity = completedActivity.groups.get(item.id)
          if (activity) return <CompletedActivity key={item.id} activity={activity} initiallyExpanded={showScrollDown} />
          switch (item.type) {
            case 'user':
              return <User key={item.id} message={item} />
            case 'agent':
              return <div key={item.id} data-completed-result={completedActivity.resultIds.has(item.id) ? item.id : undefined}>
                <Agent message={item} agentName={agentName} agentAddress={agentAddress} />
              </div>
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
              // Marks whichever card is actually waiting on the reader, so the
              // composer's "Jump to it" can find it without threading a ref through
              // this list.
              const awaitsReader = needsApproval || isAskUser
              return (
                <div key={item.id} {...(awaitsReader ? { 'data-pending-decision': '' } : {})}>
                <ToolCall
                  toolCall={item}
                  pendingApproval={needsApproval ? pendingApproval : undefined}
                  onApprovalResponse={needsApproval ? onApprovalResponse : undefined}
                  pendingAskUser={isAskUser ? pendingAskUser : undefined}
                  onAskUserResponse={isAskUser ? onAskUserResponse : undefined}
                  qrImage={isAskUser ? recentImage : undefined}
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
                    onProviderPermission={onProviderPermission}
                    providerStopPhase={providerStopPhase}
                    providerStopLifecycleOwned={Boolean(providerStopStates)}
                  />
                </div>
              )
            }
            case 'ask_user':
              // Answered on another device: the pending filters above already
              // skip it (it is `answered`), so without this line the prompt
              // would vanish with no word on what happened to it.
              if (item.answeredElsewhere) return <AnsweredElsewhere key={item.id} kind="question" />
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
              if (item.answeredElsewhere) return <AnsweredElsewhere key={item.id} kind="approval" />
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
            case 'onboard_required': {
              // ONBOARD_REQUIRED starts a challenge; ONBOARD_SUCCESS owns its
              // completion. Rendering a second collapsed "completed" card here
              // made one verification look like two separate results (#120).
              if (hasOnboardSuccess) return null
              // Only show interactive form if this is the pending onboard
              const isPending = pendingOnboard !== null
              return (
                <OnboardRequired
                  key={item.id}
                  data={item as OnboardRequiredUI}
                  onSubmit={isPending && onOnboardSubmit ? onOnboardSubmit : () => {}}
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
          }
        })}
        {footer}
      </div>
    </div>

    {/* Reserve a separate edge row: a floating button must not cover prose. */}
    {showScrollDown && (
      <div className="flex shrink-0 justify-end px-4 py-1 sm:px-6">
      <button
        onClick={scrollToBottom}
        aria-label="Latest: scroll to bottom"
        className="flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 text-xs text-neutral-600 hover:bg-neutral-50 focus-visible:outline-2 focus-visible:outline-neutral-900"
      >
        Latest <HiOutlineArrowDown aria-hidden className="h-4 w-4" />
      </button>
      </div>
    )}
    </div>
  )
}
