'use client'

import { useEffect, useRef, useMemo } from 'react'
import { cn } from './utils'
import { User, Agent, Thinking, ToolCall, AskUser, OnboardRequired, OnboardSuccess, Intent, Eval, Compact, ToolBlocked } from './messages'
import { ChatUlwCheckpoint } from './chat-ulw-checkpoint'
import type { ChatMessagesProps, OnboardRequiredUI, OnboardSuccessUI, IntentUI, EvalUI, CompactUI, ToolBlockedUI, UlwTurnsReachedUI } from './types'
import { DraftEmailButton } from './drafting/draft-email-button'

export function ChatMessages({
  ui = [],
  className,
  isLoading = false,
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

  // Find the last thinking item ID (for folding previous ones)
  const lastThinkingId = useMemo(() => {
    const thinkingItems = ui.filter(item => item.type === 'thinking')
    return thinkingItems[thinkingItems.length - 1]?.id
  }, [ui])

  // Auto-scroll when ui changes or when loading state changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [ui.length, isLoading])

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

  // Find the running exit_plan_and_implement tool call for plan review
  const pendingPlanToolId = pendingPlanReview
    ? ui.filter(item => item.type === 'tool_call' && item.name.toLowerCase() === 'exit_plan_and_implement' && item.status === 'running')
        .pop()?.id
    : null

  // Check if onboard was completed (has onboard_success event)
  const hasOnboardSuccess = ui.some(item => item.type === 'onboard_success')

  return (
    <div
      ref={scrollRef}
      className={cn('flex-1 overflow-y-auto py-6 px-4', className)}
    >
      {/* Centered container with max-width matching input */}
      <div className="mx-auto max-w-3xl space-y-1">
        {ui.map((item, index) => {
          const key = `${item.type}-${item.id ?? index}-${index}`
          switch (item.type) {
            case 'user':
              return <User key={key} message={item} />
            case 'agent':
              return <Agent key={key} message={item} />
            case 'thinking':
              return <Thinking key={key} thinking={item} isLast={item.id === lastThinkingId} />
            case 'tool_call': {
              // Pass approval info if this tool needs approval
              const needsApproval = item.id === pendingToolId
              const isAskUser = item.id === pendingAskUserToolId
              const isPlanReview = item.id === pendingPlanToolId
              const isDraft = item.name === 'make_draft' && item.status === 'done'
              return (
                <div key={key}>
                  <ToolCall
                    key={key}
                    toolCall={item}
                    pendingApproval={needsApproval ? pendingApproval : undefined}
                    onApprovalResponse={needsApproval ? onApprovalResponse : undefined}
                    pendingAskUser={isAskUser ? pendingAskUser : undefined}
                    onAskUserResponse={isAskUser ? onAskUserResponse : undefined}
                    pendingPlanReview={isPlanReview ? pendingPlanReview : undefined}
                    onPlanReviewResponse={isPlanReview ? onPlanReviewResponse : undefined}
                  />
                  {isDraft && (
                    <DraftEmailButton
                      key={`draft-${key}`}
                      args={item.args as { to: string; subject: string; body: string }}
                    />
                  )}
                </div>
              )
            }
            case 'ask_user':
              return <AskUser key={key} question={item} />
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
                  key={key}
                  data={item as OnboardRequiredUI}
                  onSubmit={isPending && onOnboardSubmit ? onOnboardSubmit : () => {}}
                  isCompleted={hasOnboardSuccess}
                />
              )
            }
            case 'onboard_success':
              return <OnboardSuccess key={key} data={item as OnboardSuccessUI} />
            case 'intent':
              return <Intent key={key} intent={item as IntentUI} />
            case 'eval':
              return <Eval key={key} eval={item as EvalUI} />
            case 'compact':
              return <Compact key={key} compact={item as CompactUI} />
            case 'tool_blocked':
              return <ToolBlocked key={key} data={item as ToolBlockedUI} />
            case 'ulw_turns_reached': {
              const isPending = pendingUlwTurnsReached !== null
              return isPending && onUlwTurnsReachedResponse ? (
                <ChatUlwCheckpoint
                  key={key}
                  checkpoint={item as UlwTurnsReachedUI}
                  onResponse={onUlwTurnsReachedResponse}
                />
              ) : null
            }
          }
        })}
      </div>
    </div>
  )
}
