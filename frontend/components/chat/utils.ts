/**
 * @purpose Tailwind CSS class merging utility for conditional styling
 * @llm-note
 *   Dependencies: imports from [clsx, tailwind-merge] | imported by [chat-activity.tsx, chat.tsx, chat-ask-user.tsx, chat-messages.tsx, chat-typing.tsx, chat-empty-state.tsx, chat-input.tsx, chat-message.tsx] | no test files found
 *   Data flow: receives variadic ClassValue arguments → clsx combines conditional classes → twMerge deduplicates Tailwind classes → returns merged string
 *   State/Effects: no state, pure function
 *   Integration: exposes {cn} utility function | used by all chat UI components for className composition
 *   Performance: lightweight, no caching (called on every render but fast)
 *   Errors: no error handling, delegates to clsx/tailwind-merge
 *
 * Why This Exists:
 *   Tailwind classes can conflict (e.g., "px-4 px-2" → only last one applies).
 *   twMerge intelligently merges conflicting Tailwind classes.
 *   clsx handles conditional class composition (arrays, objects, booleans).
 *
 * Example Usage:
 *   cn('px-4 py-2', isActive && 'bg-blue-500', { 'font-bold': isPrimary })
 *   → "px-4 py-2 bg-blue-500 font-bold" (if both conditions true)
 *
 * File Relationships:
 *     components/chat/
 *     ├── utils.ts           # THIS FILE - className utility
 *     ├── chat.tsx           # Uses cn() for conditional styling
 *     ├── chat-message.tsx   # Uses cn() for user/assistant styles
 *     ├── chat-input.tsx     # Uses cn() for focus states
 *     └── (all UI components use cn)
 */

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
