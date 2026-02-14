'use client'

/**
 * @purpose Welcome screen displayed when no messages exist - shows title, description, and clickable suggestions
 * @llm-note
 *   Dependencies: imports from [react-icons/hi, ./utils.ts, ./types.ts] | imported by [chat.tsx] | no test files found
 *   Data flow: receives {title?: string, description?: string, suggestions?: string[], onSuggestionClick?: (s: string) => void, className?: string} → renders centered welcome UI → suggestion clicks call onSuggestionClick callback
 *   State/Effects: no state, pure presentational component | onSuggestionClick triggers parent's send logic
 *   Integration: exposes ChatEmptyState component | used by Chat when messages.length === 0 | onSuggestionClick maps to Chat's onSend prop
 *   Performance: lightweight, no hooks or effects
 *   Errors: no error handling, gracefully handles missing optional props
 *
 * Default Values:
 *   - title: "How can I help you today?"
 *   - description: undefined (not shown)
 *   - suggestions: [] (empty array, no buttons shown)
 *
 * Layout Structure:
 *   - Centered vertically and horizontally (flex-1 items-center justify-center)
 *   - Sparkles icon in rounded gray box (decorative)
 *   - Title in large semibold text
 *   - Optional description below title
 *   - Suggestion buttons in flex-wrap grid
 *
 * Suggestion Buttons:
 *   - Rounded pill style (rounded-full)
 *   - Hover effects: border darkens, background lightens
 *   - Click scales down (active:scale-[0.98])
 *   - Maps to parent's onSend for quick prompts
 *
 * File Relationships:
 *     components/chat/
 *     ├── chat-empty-state.tsx   # THIS FILE - welcome screen
 *     ├── chat.tsx               # Parent, conditionally renders when empty
 *     ├── types.ts               # ChatEmptyStateProps type
 *     └── utils.ts               # cn() utility
 *
 *     app/
 *     └── page.tsx               # Provides suggestions array and custom title/description
 */

import { cn } from './utils'
import type { ChatEmptyStateProps } from './types'

export function ChatEmptyState({
  title = 'Start a conversation',
  description = 'Ask anything or try one of these suggestions',
  suggestions = [],
  onSuggestionClick,
  className,
}: ChatEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center p-8',
        className
      )}
    >
      {/* Logo matching sidebar branding */}
      <img
        src="https://raw.githubusercontent.com/wu-changxing/openonion-assets/master/imgs/Onion.png"
        alt="OpenOnion"
        width={56}
        height={56}
        className="mb-6 rounded-2xl shadow-lg"
      />

      {/* Title */}
      <h2 className="mb-2 text-2xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h2>

      {/* Description */}
      {description && (
        <p className="max-w-md text-center text-base text-neutral-500">
          {description}
        </p>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-2 max-w-lg">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onSuggestionClick?.(suggestion)}
              className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-700 transition-all duration-200 hover:border-neutral-300 hover:bg-neutral-100 active:scale-[0.98] shadow-sm"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
