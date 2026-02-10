'use client'

import type { ToolCallUI, PendingApproval, PendingAskUser } from '../types'
import { BashCard, FileCard, FileDiffCard, GrepCard, GenericCard, AskUserCard, BackgroundCard } from './tools'

interface ToolCallProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
}

/**
 * Dispatcher for tool call UI cards.
 * Routes to specialized cards based on tool name.
 */
export function ToolCall({ toolCall, pendingApproval, onApprovalResponse, pendingAskUser, onAskUserResponse }: ToolCallProps) {
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
      return <AskUserCard toolCall={toolCall} pendingAskUser={pendingAskUser} onAskUserResponse={onAskUserResponse} />

    case 'call_omo_agent':
    case 'background_output':
    case 'background_cancel':
      return <BackgroundCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />

    default:
      return <GenericCard toolCall={toolCall} pendingApproval={pendingApproval} onApprovalResponse={onApprovalResponse} />
  }
}
