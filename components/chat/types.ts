/**
 * @purpose TypeScript type definitions for oo-chat component library
 * @llm-note
 *   Dependencies: imports the normalized ChatItem contract from @connectonion/react | imported by chat components and use-agent-sdk.ts
 *   Data flow: defines shared interfaces used across entire chat component library → no data transformation, pure type definitions
 *   State/Effects: no state or side effects, pure type definitions
 *   Integration: exposes presentation aliases and component props; raw wire DTOs stay in the SDK
 *   Performance: compile-time only, zero runtime cost
 *   Errors: no error handling, pure TypeScript types
 *
 * Type Categories:
 *   Core Types:
 *     - Message: Chat message data (user/assistant/system)
 *     - UI: SDK-normalized messages and agent activity
 *     - PendingAskUser: Interactive question awaiting user response
 *
 *   Wire protocol types deliberately do not live in the component layer.
 *
 *   Component Props:
 *     - ChatProps: Main chat component props (messages, activities, ask_user)
 *     - ChatMessageProps, ChatInputProps, etc.: Individual component interfaces
 *
 * File Relationships:
 *     components/chat/
 *     ├── types.ts                  # THIS FILE - shared type definitions
 *     ├── use-chat.ts               # Uses Message type
 *     ├── use-agent-sdk.ts          # Supplies normalized ChatItem[]
 *     ├── chat.tsx                  # Uses ChatProps
 *     ├── chat-message.tsx          # Uses ChatMessageProps, Message
 *     ├── chat-messages.tsx         # Uses ChatMessagesProps, Message
 *     ├── chat-input.tsx            # Uses ChatInputProps
 *     ├── chat-empty-state.tsx      # Uses ChatEmptyStateProps
 *     ├── chat-ask-user.tsx         # Uses PendingAskUser
 *     └── index.ts                  # Re-exports all types
 */

import type {
  ChatItem,
  CollaborationMode as SDKCollaborationMode,
  PermissionProfile as SDKPermissionProfile,
} from '@connectonion/react'

export interface FileAttachment {
  name: string
  type: string
  size: number
  dataUrl: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: Date
}

export interface PendingAskUser {
  question: string
  options: string[]
  multi_select: boolean
  input_type?: string
  fields?: AskUserField[]
}

export interface AskUserField {
  name: string
  label: string
  type?: 'text' | 'password'
  placeholder?: string
  required?: boolean
  autocomplete?: string
}

export interface PendingApproval {
  tool: string
  arguments: Record<string, unknown>
  description?: string
  batch_remaining?: Array<{ tool: string; arguments: string }>
}

export interface PendingOnboard {
  methods: string[]
  paymentAmount?: number
  paymentAddress?: string  // Agent's address for payment transfer
}

export interface PendingFullAccessCheckpoint {
  id: string
  turns_used: number
  max_turns: number
}

export interface PendingPlanReview {
  plan_content: string
}

// UI types come from @connectonion/react's normalized ChatItem contract.
export type UIType = ChatItem['type']

export type UserUI = Extract<ChatItem, { type: 'user' }>
export type AgentUI = Extract<ChatItem, { type: 'agent' }>

/** Thinking presentation item derived from the normalized SDK contract. */
export type ThinkingUI = Extract<ChatItem, { type: 'thinking' }>

export type ToolCallUI = Extract<ChatItem, { type: 'tool_call' }>
export type AskUserUI = Extract<ChatItem, { type: 'ask_user' }>
export type ApprovalNeededUI = Extract<ChatItem, { type: 'approval_needed' }>
export type OnboardRequiredUI = Extract<ChatItem, { type: 'onboard_required' }>
export type OnboardSuccessUI = Extract<ChatItem, { type: 'onboard_success' }>

export type IntentUI = Extract<ChatItem, { type: 'intent' }>
export type EvalUI = Extract<ChatItem, { type: 'eval' }>
export type CompactUI = Extract<ChatItem, { type: 'compact' }>
export type ToolBlockedUI = Extract<ChatItem, { type: 'tool_blocked' }>
export type FullAccessCheckpointUI = Extract<ChatItem, { type: 'full_access_checkpoint' }>
export type PlanReviewUI = Extract<ChatItem, { type: 'plan_review' }>
export type FilesReceivedUI = Extract<ChatItem, { type: 'files_received' }>

/** Union of all UI types */
export type UI = ChatItem

export type CollaborationMode = SDKCollaborationMode
export type PermissionProfile = SDKPermissionProfile

export interface SkillInfo {
  name: string
  description: string
  location?: string
}

export interface ChatProps {
  ui?: UI[]
  onSend: (message: string, images?: string[], files?: FileAttachment[]) => void
  /** Gracefully stop the running agent (shown as a stop button while isLoading) */
  onStop?: () => void
  isLoading?: boolean
  /** Disable every message entry point while a Host policy write is pending. */
  inputDisabled?: boolean
  placeholder?: string
  className?: string
  emptyStateTitle?: string
  emptyStateDescription?: string
  suggestions?: string[]
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingOnboard?: PendingOnboard | null
  onOnboardSubmit?: (options: { inviteCode?: string; payment?: number }) => void
  pendingFullAccessCheckpoint?: PendingFullAccessCheckpoint | null
  onFullAccessCheckpointResponse?: () => void
  pendingPlanReview?: PendingPlanReview | null
  onPlanReviewResponse?: (message: string) => void
  /** Custom status bar inside input (e.g., mode indicator) */
  statusBar?: React.ReactNode
  /** False only when the agent has declared it takes neither images nor files. */
  acceptsAttachments?: boolean
  /** Full access state for 3-state bottom panel */
  permissionProfile?: PermissionProfile
  fullAccessTurnsRemaining?: number | null
  onFullAccessStop?: () => void
  onFullAccessGoalSave?: (goal: string) => void
  onFullAccessDirectionSave?: (direction: string) => void
  fullAccessGoal?: string
  fullAccessDirection?: string
  /** Session active state — derived from processing status + connection */
  sessionState: 'idle' | 'connected' | 'active' | 'disconnected' | 'reconnecting'
  /** Connection error for retry functionality */
  connectionError?: string | null
  onRetry?: () => void
  /** Dismiss the error banner without resending anything */
  onDismissError?: () => void
  skills?: SkillInfo[]
}

export interface ChatMessageProps {
  message: Message
  className?: string
}

export interface ChatInputProps {
  /** The run is stopped on a question only the reader can answer. The composer
   *  should say so instead of offering to interrupt work that is not happening. */
  awaitingYou?: boolean
  /** Bring the pending question back on screen — it scrolls away like any item. */
  onJumpToPending?: () => void
  onSend: (message: string, images?: string[], files?: FileAttachment[]) => void
  /** Gracefully stop the running agent; when provided, the send button becomes a stop button while isLoading */
  onStop?: () => void
  isLoading?: boolean
  placeholder?: string
  className?: string
  /** Status bar below input (mode indicator + hints) */
  statusBar?: React.ReactNode
  skills?: SkillInfo[]
  /** False only when the agent has declared it takes neither images nor files. */
  acceptsAttachments?: boolean
  disabled?: boolean
}

export interface ChatMessagesProps {
  ui?: UI[]
  className?: string
  isLoading?: boolean
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
  pendingOnboard?: PendingOnboard | null
  onOnboardSubmit?: (options: { inviteCode?: string; payment?: number }) => void
  pendingFullAccessCheckpoint?: PendingFullAccessCheckpoint | null
  onFullAccessCheckpointResponse?: () => void
  pendingPlanReview?: PendingPlanReview | null
  onPlanReviewResponse?: (message: string) => void
}

export interface ChatEmptyStateProps {
  title?: string
  description?: string
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
  className?: string
}
