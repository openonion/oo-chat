/**
 * @purpose TypeScript type definitions for oo-chat component library
 * @llm-note
 *   Dependencies: imports none | imported by [use-agent-stream.ts, chat-activity.tsx, index.ts, use-agent-sdk.ts, chat.tsx, chat-ask-user.tsx, chat-messages.tsx, chat-empty-state.tsx, chat-input.tsx, chat-message.tsx, use-chat.ts] | no test files found
 *   Data flow: defines shared interfaces used across entire chat component library → no data transformation, pure type definitions
 *   State/Effects: no state or side effects, pure type definitions
 *   Integration: exposes {Message, StreamEventType, WsMessageType, AskUserEvent, StreamEvent, Activity, PendingAskUser, ChatProps, ChatMessageProps, ChatInputProps, ChatMessagesProps, ChatEmptyStateProps} | used by all chat components and hooks
 *   Performance: compile-time only, zero runtime cost
 *   Errors: no error handling, pure TypeScript types
 *
 * Type Categories:
 *   Core Types:
 *     - Message: Chat message data (user/assistant/system)
 *     - Activity: Agent execution events (tool calls, LLM calls, thinking)
 *     - PendingAskUser: Interactive question awaiting user response
 *
 *   Event Types:
 *     - StreamEventType: Agent activity events (thinking, tool_call, llm_call, etc.)
 *     - WsMessageType: WebSocket protocol messages (INPUT, OUTPUT, ERROR + StreamEventTypes)
 *     - StreamEvent: Full event payload with optional fields for different event types
 *
 *   Component Props:
 *     - ChatProps: Main chat component props (messages, activities, ask_user)
 *     - ChatMessageProps, ChatInputProps, etc.: Individual component interfaces
 *
 * File Relationships:
 *     components/chat/
 *     ├── types.ts                  # THIS FILE - shared type definitions
 *     ├── use-chat.ts               # Uses Message type
 *     ├── use-agent-stream.ts       # Uses Message, Activity, StreamEvent, PendingAskUser
 *     ├── use-agent-sdk.ts          # Uses Message, Activity, PendingAskUser
 *     ├── chat.tsx                  # Uses ChatProps
 *     ├── chat-message.tsx          # Uses ChatMessageProps, Message
 *     ├── chat-messages.tsx         # Uses ChatMessagesProps, Message
 *     ├── chat-input.tsx            # Uses ChatInputProps
 *     ├── chat-empty-state.tsx      # Uses ChatEmptyStateProps
 *     ├── chat-activity.tsx         # Uses Activity, StreamEvent
 *     ├── chat-ask-user.tsx         # Uses PendingAskUser
 *     └── index.ts                  # Re-exports all types
 */

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: Date
}

export type StreamEventType =
  | 'user_input'
  | 'thinking'
  | 'llm_call'      // Backend sends this when LLM completes
  | 'tool_call'     // Backend sends this BEFORE tool execution
  | 'tool_result'   // Backend sends this AFTER tool execution
  | 'assistant'
  | 'error'
  | 'complete'
  | 'ask_user'

export type WsMessageType = StreamEventType | 'OUTPUT' | 'ERROR' | 'INPUT'

export interface AskUserEvent {
  type: 'ask_user'
  question: string
  options?: string[]
  multi_select?: boolean
}

export interface StreamEvent {
  type: WsMessageType
  id?: string  // Tool call ID for matching tool_call with tool_result
  content?: string
  kind?: 'intent' | 'plan' | 'reflect'
  name?: string
  args?: Record<string, unknown>
  status?: 'success' | 'error' | 'not_found'
  result?: string
  timing_ms?: number
  error?: string
  source?: string
  message?: string
  tools_used?: string[]
  llm_calls?: number
  iterations?: number
  // ask_user fields
  question?: string
  options?: string[]
  multi_select?: boolean
}

export interface Activity {
  id: string
  type: StreamEventType  // Only streaming events, not protocol messages
  data: StreamEvent
  timestamp: Date
}

export interface PendingAskUser {
  question: string
  options: string[]
  multi_select: boolean
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

export interface PendingUlwTurnsReached {
  turns_used: number
  max_turns: number
}

// UI types (matches ConnectOnion SDK: connectonion-ts/src/connect.ts)
export type UIType = 'user' | 'agent' | 'thinking' | 'tool_call' | 'ask_user' | 'approval_needed' | 'onboard_required' | 'onboard_success' | 'intent' | 'eval' | 'compact' | 'tool_blocked' | 'ulw_turns_reached'

/** Base UI with common fields */
interface BaseUI {
  id: string
  type: UIType
}

/** User message */
export interface UserUI extends BaseUI {
  type: 'user'
  content: string
  images?: string[]
}

/** Agent response */
export interface AgentUI extends BaseUI {
  type: 'agent'
  content: string
  images?: string[]
}

/** Token usage info from LLM */
export interface TokenUsage {
  input_tokens?: number
  output_tokens?: number
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  cost?: number
}

/** Thinking indicator */
export interface ThinkingUI extends BaseUI {
  type: 'thinking'
  status: 'running' | 'done' | 'error'
  content?: string
  kind?: 'intent' | 'plan' | 'reflect'
  model?: string
  duration_ms?: number
  context_percent?: number  // Context window usage percentage
  usage?: TokenUsage
}

/** Tool execution (merged from tool_call + tool_result) */
export interface ToolCallUI extends BaseUI {
  type: 'tool_call'
  name: string
  args?: Record<string, unknown>
  status: 'running' | 'done' | 'error'
  result?: string
  timing_ms?: number
}

/** Ask user */
export interface AskUserUI extends BaseUI {
  type: 'ask_user'
  text: string
}

/** Approval needed for dangerous tool */
export interface ApprovalNeededUI extends BaseUI {
  type: 'approval_needed'
  tool: string
  arguments: Record<string, unknown>
  description?: string
  batch_remaining?: Array<{ tool: string; arguments: string }>
}

/** Onboard required for stranger */
export interface OnboardRequiredUI extends BaseUI {
  type: 'onboard_required'
  methods: string[]
  paymentAmount?: number
  paymentAddress?: string  // Agent's address for payment transfer
}

/** Onboard success */
export interface OnboardSuccessUI extends BaseUI {
  type: 'onboard_success'
  level: string
  message: string
}

/** Intent analysis (user feels seen) */
export interface IntentUI extends BaseUI {
  type: 'intent'
  status: 'analyzing' | 'understood'
  ack?: string  // Acknowledgment message e.g., "checking the files in this directory"
  is_build?: boolean  // Whether this is a build/code task
}

/** Evaluation result from eval plugin (structured) */
export interface EvalUI extends BaseUI {
  type: 'eval'
  status: 'evaluating' | 'done'
  passed?: boolean     // True if task completed successfully
  summary?: string     // Brief explanation (1-2 sentences)
  expected?: string    // What should happen
  eval_path?: string   // Path to eval file (.co/evals/...)
}

/** Auto-compact event from auto_compact plugin */
export interface CompactUI extends BaseUI {
  type: 'compact'
  status: 'compacting' | 'done' | 'error'
  context_before?: number  // Context % before compact
  context_after?: number   // Context % after compact
  context_percent?: number // Current context % (when compacting)
  message?: string
  error?: string
}

/** Tool blocked (e.g., bash file creation blocked by prefer_write_tool) */
export interface ToolBlockedUI extends BaseUI {
  type: 'tool_blocked'
  tool: string      // Tool that was blocked
  reason: string    // Why it was blocked (e.g., 'file_creation')
  message: string   // Human-readable message
}

/** ULW turns reached checkpoint */
export interface UlwTurnsReachedUI extends BaseUI {
  type: 'ulw_turns_reached'
  turns_used: number
  max_turns: number
}

/** Union of all UI types */
export type UI = UserUI | AgentUI | ThinkingUI | ToolCallUI | AskUserUI | ApprovalNeededUI | OnboardRequiredUI | OnboardSuccessUI | IntentUI | EvalUI | CompactUI | ToolBlockedUI | UlwTurnsReachedUI

/** Approval mode (matches ConnectOnion SDK) */
export type ApprovalMode = 'safe' | 'plan' | 'accept_edits' | 'ulw'

export interface ChatProps {
  ui?: UI[]
  onSend: (message: string, images?: string[]) => void
  isLoading?: boolean
  placeholder?: string
  className?: string
  emptyStateTitle?: string
  emptyStateDescription?: string
  suggestions?: string[]
  elapsedTime?: number
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingOnboard?: PendingOnboard | null
  onOnboardSubmit?: (options: { inviteCode?: string; payment?: number }) => void
  pendingUlwTurnsReached?: PendingUlwTurnsReached | null
  onUlwTurnsReachedResponse?: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void
  /** Custom status bar inside input (e.g., mode indicator) */
  statusBar?: React.ReactNode
  /** ULW state for 3-state bottom panel */
  mode?: ApprovalMode
  ulwTurnsRemaining?: number | null
  ulwSetupActive?: boolean
  onUlwStart?: (turns: number, goal: string, direction: string) => void
  onUlwStop?: () => void
  onUlwSetupCancel?: () => void
  onUlwGoalSave?: (goal: string) => void
  onUlwDirectionSave?: (direction: string) => void
  ulwGoal?: string
  ulwDirection?: string
}

export interface ChatMessageProps {
  message: Message
  className?: string
}

export interface ChatInputProps {
  onSend: (message: string, images?: string[]) => void
  isLoading?: boolean
  placeholder?: string
  className?: string
  /** Status bar below input (mode indicator + hints) */
  statusBar?: React.ReactNode
}

export interface ChatMessagesProps {
  ui?: UI[]
  className?: string
  elapsedTime?: number
  isLoading?: boolean
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
  pendingOnboard?: PendingOnboard | null
  onOnboardSubmit?: (options: { inviteCode?: string; payment?: number }) => void
  pendingUlwTurnsReached?: PendingUlwTurnsReached | null
  onUlwTurnsReachedResponse?: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void
}

export interface ChatEmptyStateProps {
  title?: string
  description?: string
  suggestions?: string[]
  onSuggestionClick?: (suggestion: string) => void
  className?: string
}
