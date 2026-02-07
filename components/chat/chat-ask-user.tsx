'use client'

/**
 * @purpose Interactive question prompt allowing user to answer agent's ask_user requests via options or text input
 * @llm-note
 *   Dependencies: imports from [react, ./utils.ts, ./types.ts] | imported by [chat.tsx] | no test files found
 *   Data flow: receives {askUser: PendingAskUser, onResponse: (answer: string | string[]) => void, className?: string} → user selects option(s) or types text → onResponse callback sends answer back to agent
 *   State/Effects: useState manages selected options (multi-select) and text input | onResponse triggers WebSocket message to agent (via useAgentStream or useAgentSDK)
 *   Integration: exposes ChatAskUser component | used by Chat when pendingAskUser is not null | response flows back via WebSocket ASK_USER_RESPONSE message
 *   Performance: simple state management, no optimizations needed
 *   Errors: no error handling, assumes valid PendingAskUser structure
 *
 * Interaction Modes:
 *   1. Single-select options (multi_select=false):
 *      - Click option → immediately calls onResponse(option)
 *      - No confirm button needed
 *
 *   2. Multi-select options (multi_select=true):
 *      - Click toggles checkbox selection
 *      - Confirm button appears when selected.length > 0
 *      - Sends array of selected strings
 *
 *   3. Free text input (no options):
 *      - Text input with submit button
 *      - Enter key submits
 *      - Auto-focus for immediate typing
 *
 * UI Styling:
 *   - Blue theme (border-blue-200, bg-blue-50)
 *   - Option buttons with toggle states
 *   - Checkbox symbols (☑ / ☐) for multi-select
 *   - Disabled state when no input
 *
 * File Relationships:
 *     components/chat/
 *     ├── chat-ask-user.tsx    # THIS FILE - interactive prompt
 *     ├── chat.tsx             # Parent, shows when pendingAskUser exists
 *     ├── use-agent-stream.ts  # Sets pendingAskUser on ask_user event, respondToAskUser sends response
 *     ├── use-agent-sdk.ts     # Converts SDK ask_user events to PendingAskUser
 *     ├── types.ts             # PendingAskUser type
 *     └── utils.ts             # cn() utility
 */

import { useState } from 'react'
import { 
  HiOutlineCheckCircle, 
  HiOutlineCheck,
  HiOutlinePaperAirplane,
  HiOutlineQuestionMarkCircle
} from 'react-icons/hi'
import { cn } from './utils'
import type { PendingAskUser } from './types'

interface ChatAskUserProps {
  askUser: PendingAskUser
  onResponse: (answer: string | string[]) => void
  className?: string
}

export function ChatAskUser({ askUser, onResponse, className }: ChatAskUserProps) {
  const { question, options, multi_select } = askUser
  const [selected, setSelected] = useState<string[]>([])
  const [textInput, setTextInput] = useState('')

  const handleOptionClick = (option: string) => {
    if (multi_select) {
      setSelected(prev =>
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      )
    } else {
      onResponse(option)
    }
  }

  const handleSubmit = () => {
    if (multi_select && selected.length > 0) {
      onResponse(selected)
    } else if (textInput.trim()) {
      onResponse(textInput.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className={cn(
      'mx-4 mb-5 rounded-2xl border border-amber-200 bg-amber-50/20 overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500',
      className
    )}>
      {/* Header-like question area */}
      <div className="p-5 border-b border-amber-100 bg-amber-50/40">
        <div className="flex items-start gap-4">
          <div className="shrink-0 mt-0.5 bg-amber-100/80 p-1.5 rounded-lg">
            <HiOutlineQuestionMarkCircle className="w-5 h-5 text-amber-700" />
          </div>
          <p className="text-sm font-semibold text-amber-950 leading-relaxed">{question}</p>
        </div>
      </div>

      {/* Input area */}
      <div className="p-4 space-y-4">
        {options && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-1 gap-1.5">
              {options.map((option, idx) => {
                const isSelected = selected.includes(option)
                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(option)}
                    className={cn(
                      'flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left text-sm transition-all duration-200 group border',
                      isSelected
                        ? 'bg-white text-amber-900 shadow-sm border-amber-200'
                        : 'bg-white/40 text-neutral-600 hover:bg-white/80 hover:text-neutral-900 border-transparent hover:border-amber-100'
                    )}
                  >
                    <div className="shrink-0">
                      {multi_select ? (
                        isSelected ? (
                          <HiOutlineCheckCircle className="w-5 h-5 text-amber-500" />
                        ) : (
                          <div className="w-5 h-5 rounded-full border-2 border-neutral-200 group-hover:border-amber-300 transition-colors" />
                        )
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-neutral-200 group-hover:border-amber-300 transition-colors" />
                      )}
                    </div>
                    <span className={cn(isSelected ? 'font-bold' : 'font-medium')}>
                      {option}
                    </span>
                  </button>
                )
              })}
            </div>
            
            {multi_select && (
              <div className="mt-4 pt-4 border-t border-amber-100 flex items-center justify-between px-1">
                <span className="text-[10px] text-amber-700 uppercase font-bold tracking-widest">
                  {selected.length === 0 
                    ? "Select options" 
                    : `${selected.length} selected`}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={selected.length === 0}
                  className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-20 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                >
                  <HiOutlineCheck className="w-4 h-4" />
                  Confirm Selection
                </button>
              </div>
            )}
          </div>
        )}

        {/* Input Fallback */}
        <div className="space-y-3 pt-1">
          {options && (
            <div className="flex items-center gap-2 px-1">
              <div className="h-px flex-1 bg-amber-100" />
              <span className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest">Or enter custom value</span>
              <div className="h-px flex-1 bg-amber-100" />
            </div>
          )}

          <div className="flex gap-2 bg-white/60 p-1.5 rounded-xl border border-amber-100 shadow-sm focus-within:bg-white focus-within:border-amber-300 focus-within:ring-4 focus-within:ring-amber-500/5 transition-all">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={options ? "Custom answer..." : "Type your answer..."}
              className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-neutral-400 font-medium"
              autoFocus={!options}
            />
            <button
              onClick={handleSubmit}
              disabled={!textInput.trim()}
              className="flex items-center justify-center w-11 h-11 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-10 transition-all shadow-sm active:scale-90"
            >
              <HiOutlinePaperAirplane className="w-5 h-5 rotate-90" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
