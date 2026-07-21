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

// Save an image (data: URI or http(s) URL) to disk. Fetch → blob → <a download>
// works for data: and same-origin/CORS-enabled URLs; this is the only reliable
// path for base64 data: images, which Chrome refuses to open via window.open.
// Cross-origin images without CORS fail the fetch and fall back to a new tab.
export async function downloadImage(src: string, name: string) {
  try {
    const res = await fetch(src)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch {
    window.open(src, '_blank')
  }
}

// Best-effort extension for the download filename, from a data: mime or URL suffix.
function imageExt(src: string): string {
  const mime = src.match(/^data:image\/([a-z0-9.+-]+)/i)?.[1]
  if (mime) return mime.toLowerCase() === 'jpeg' ? 'jpg' : mime.toLowerCase()
  const suffix = src.split(/[?#]/)[0].match(/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i)?.[1]
  return suffix ? suffix.toLowerCase() : 'png'
}

export function imageFileName(src: string, index: number): string {
  return `image-${index + 1}.${imageExt(src)}`
}
