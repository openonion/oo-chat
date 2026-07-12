'use client'

import { useEffect, useRef, useMemo, useState } from 'react'
import { HiOutlineArrowDown } from 'react-icons/hi'
import { cn } from './utils'
import { User, Agent, Thinking, ToolCall, AskUser, OnboardRequired, OnboardSuccess, Intent, Eval, Compact, ToolBlocked, FilesReceived } from './messages'
import { ChatAskUser } from './chat-ask-user'
import { ChatUlwCheckpoint } from './chat-ulw-checkpoint'
import type { ChatMessagesProps, OnboardRequiredUI, OnboardSuccessUI, IntentUI, EvalUI, CompactUI, ToolBlockedUI, UlwTurnsReachedUI, PendingPlanReview, FilesReceivedUI } from './types'

export function ChatMessages({
  ui = [],
  className,
  pendingApproval,
  onApprovalResponse,
  pendingAskUser,
  onAskUserResponse,
  pendingOnboard,
  onOnboardSubmit,
  pendingUlwTurnsReached,
  onUlwTurnsReachedResponse,
  pendingPlanReview,
  onPlanReviewResponse,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  // Follow new content only while the user is at the bottom — never yank a reader
  // back down who scrolled up. Streamed tokens grow items in place (ui.length
  // unchanged), so we watch content height, not the item count.
  const stickToBottomRef = useRef(true)
  const [showScrollDown, setShowScrollDown] = useState(false)

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stickToBottomRef.current = atBottom
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
    const observer = new ResizeObserver(() => {
      if (stickToBottomRef.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  // Find the last thinking item ID (for folding previous ones)
  const lastThinkingId = useMemo(() => {
    const thinkingItems = ui.filter(item => item.type === 'thinking')
    return thinkingItems[thinkingItems.length - 1]?.id
  }, [ui])

  // Find the last tool_call that matches the pending approval (by tool name)
  // Backend sends approval key as "bash:uname" format — match against base name before ":"
  const approvalToolName = pendingApproval?.tool.split(':')[0].toLowerCase()
  const pendingToolId = pendingApproval
    ? ui.filter(item => item.type === 'tool_call' && item.name.toLowerCase() === approvalToolName)
        .pop()?.id
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
      <div ref={contentRef} className="mx-auto max-w-3xl space-y-1">
        {ui.map((item) => {
          switch (item.type) {
            case 'user':
              return <User key={item.id} message={item} />
            case 'agent':
              return <Agent key={item.id} message={item} />
            case 'thinking':
              return <Thinking key={item.id} thinking={item} isLast={item.id === lastThinkingId} />
            case 'tool_call': {
              // Pass approval info if this tool needs approval
              const needsApproval = item.id === pendingToolId
              const isAskUser = item.id === pendingAskUserToolId
              const isPlanReview = item.id === pendingPlanToolId
              return (
                <ToolCall
                  key={item.id}
                  toolCall={item}
                  pendingApproval={needsApproval ? pendingApproval : undefined}
                  onApprovalResponse={needsApproval ? onApprovalResponse : undefined}
                  pendingAskUser={isAskUser ? pendingAskUser : undefined}
                  onAskUserResponse={isAskUser ? onAskUserResponse : undefined}
                  qrImage={isAskUser ? recentImage : undefined}
                  pendingPlanReview={isPlanReview ? pendingPlanReview : undefined}
                  onPlanReviewResponse={isPlanReview ? onPlanReviewResponse : undefined}
                />
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
              // Don't render separate approval message - it's shown inline in tool card
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
            case 'ulw_turns_reached': {
              const isPending = pendingUlwTurnsReached !== null
              return isPending && onUlwTurnsReachedResponse ? (
                <ChatUlwCheckpoint
                  key={item.id}
                  checkpoint={item as UlwTurnsReachedUI}
                  onResponse={onUlwTurnsReachedResponse}
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
