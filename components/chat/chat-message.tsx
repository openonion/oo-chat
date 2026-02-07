'use client'

/**
 * @purpose Individual chat message bubble with role-based styling (user vs assistant)
 * @llm-note
 *   Dependencies: imports from [./utils.ts, ./types.ts] | imported by [chat-messages.tsx] | no test files found
 *   Data flow: receives {message: Message, className?: string} → renders styled message bubble based on role → no data output
 *   State/Effects: no state, pure presentational component
 *   Integration: exposes ChatMessage component | used by ChatMessages to render each message in the list | called via messages.map(m => <ChatMessage message={m} />)
 *   Performance: lightweight, no hooks or effects, pure render
 *   Errors: no error handling, assumes valid Message object
 *
 * Styling Patterns:
 *   User Messages (role='user'):
 *     - Right-aligned with justify-end
 *     - Neutral gray bubble (bg-neutral-100)
 *     - Max 85% width to prevent edge-to-edge on mobile
 *     - Rounded corners (rounded-2xl)
 *
 *   Assistant Messages (role='assistant'):
 *     - Left-aligned, no bubble background
 *     - Plain text with right padding (pr-12)
 *     - Full width within max-w-3xl container
 *     - Same typography as user for consistency
 *
 * Animation:
 *   - Tailwind animate-in with fade-in and slide-in-from-bottom-2
 *   - 200ms duration for smooth message appearance
 *
 * File Relationships:
 *     components/chat/
 *     ├── chat-message.tsx    # THIS FILE - individual message
 *     ├── chat-messages.tsx   # Parent, renders list of ChatMessage
 *     ├── types.ts            # Message, ChatMessageProps types
 *     └── utils.ts            # cn() utility
 */

import { cn } from './utils'
import type { ChatMessageProps } from './types'

export function ChatMessage({ message, className }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <div className="mx-auto max-w-3xl">
        {isUser ? (
          // User message - right-aligned bubble
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl bg-neutral-100 px-4 py-3">
              <p className="text-base leading-relaxed text-neutral-900 whitespace-pre-wrap break-words">
                {message.content}
              </p>
            </div>
          </div>
        ) : (
          // Assistant message - left-aligned, no bubble
          <div className="pr-12">
            <p className="text-base leading-relaxed text-neutral-900 whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
