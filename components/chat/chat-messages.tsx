'use client'

import { useEffect, useRef, useMemo } from 'react'
import { cn } from './utils'
import { User, Agent, Thinking, ToolCall, AskUser, OnboardRequired, OnboardSuccess, Intent, Eval, Compact, ToolBlocked } from './messages'
import type { ChatMessagesProps, OnboardRequiredUI, OnboardSuccessUI, IntentUI, EvalUI, CompactUI, ToolBlockedUI } from './types'

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

  // Check if onboard was completed (has onboard_success event)
  const hasOnboardSuccess = ui.some(item => item.type === 'onboard_success')

  return (
    <div
      ref={scrollRef}
      className={cn('flex-1 overflow-y-auto py-6 px-4', className)}
    >
      {/* Centered container with max-width matching input */}
      <div className="mx-auto max-w-3xl space-y-1">
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
              return (
                <ToolCall
                  key={item.id}
                  toolCall={item}
                  pendingApproval={needsApproval ? pendingApproval : undefined}
                  onApprovalResponse={needsApproval ? onApprovalResponse : undefined}
                  pendingAskUser={isAskUser ? pendingAskUser : undefined}
                  onAskUserResponse={isAskUser ? onAskUserResponse : undefined}
                />
              )
            }
            case 'ask_user':
              return <AskUser key={item.id} question={item} />
            case 'approval_needed':
              // Don't render separate approval message - it's shown inline in tool card
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
          }
        })}
      </div>
    </div>
  )
}
