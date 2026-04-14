'use client'

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
