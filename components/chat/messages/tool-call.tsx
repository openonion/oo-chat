'use client'

import type { ToolCallUI, PendingApproval, PendingAskUser, PendingPlanReview } from '../types'
import { BashCard, FileCard, FileDiffCard, GrepCard, GenericCard, AskUserCard, LoginCard, BackgroundCard, PlanCard, GuideCard, EnterPlanModeCard, BrowserCard, BROWSER_TOOLS } from './tools'

interface ToolCallProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
  qrImage?: string
  pendingPlanReview?: PendingPlanReview | null
  onPlanReviewResponse?: (message: string) => void
}

/**
 * Dispatcher for tool call UI cards.
 * Routes to specialized cards based on tool name.
 */
export function ToolCall({ toolCall, pendingApproval, onApprovalResponse, pendingAskUser, onAskUserResponse, qrImage, pendingPlanReview, onPlanReviewResponse }: ToolCallProps) {
  const toolName = toolCall.name.toLowerCase()

  // Route to specialized cards
  switch (toolName) {
    case 'bash':
    case 'shell':
    case 'run':
    case 'run_background':
      return <BashCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />

    case 'write':
    case 'read':
    case 'read_file':
      return <FileCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />

    case 'edit':
      return <FileDiffCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />

    case 'grep':
    case 'glob':
    case 'search':
    case 'find':
      return <GrepCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />

    case 'ask_user':
      // Credentials form (has fields) → separate LoginCard (pop-up, no transcript leak).
      return toolCall.args?.fields
        ? <LoginCard toolCall={toolCall} pendingAskUser={pendingAskUser} onAskUserResponse={onAskUserResponse} />
        : <AskUserCard toolCall={toolCall} pendingAskUser={pendingAskUser} onAskUserResponse={onAskUserResponse} qrImage={qrImage} />

    case 'write_plan':
      return <GenericCard toolCall={toolCall} />

    case 'exit_plan_and_implement':
      return <PlanCard toolCall={toolCall} pendingPlanReview={pendingPlanReview} onPlanReviewResponse={onPlanReviewResponse} />

    case 'load_guide':
      return <GuideCard toolCall={toolCall} />

    case 'enter_plan_mode':
      return <EnterPlanModeCard toolCall={toolCall} />

    case 'call_omo_agent':
    case 'background_output':
    case 'background_cancel':
      return <BackgroundCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />

    default:
      if (BROWSER_TOOLS.has(toolName)) {
        return <BrowserCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />
      }
      return <GenericCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />
  }
}
