'use client'

/**
 * @purpose Auto-resizing textarea message input with voice input and keyboard shortcuts
 */

import { useState, useRef, useCallback, useEffect, KeyboardEvent } from 'react'
import { HiOutlineArrowUp, HiOutlineMicrophone, HiOutlineStop } from 'react-icons/hi'
import { useVoiceInput } from 'connectonion/react'
import { useChatStore } from '@/store/chat-store'
import { cn } from './utils'
import type { ChatInputProps } from './types'

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Message...',
  hint,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const apiKey = useChatStore(state => state.openonionApiKey)

  // Voice input - click to toggle recording
  const {
    isRecording,
    isTranscribing,
    duration,
    error: voiceError,
    startRecording,
    stopRecording,
  } = useVoiceInput({
    apiKey: apiKey || undefined,
    onTranscribed: (text) => {
      setValue(prev => prev ? `${prev} ${text}` : text)
    },
    onError: (err) => {
      console.error('Voice input error:', err)
    },
  })

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return

    onSend(trimmed)
    setValue('')
    // Height resets automatically via useEffect when value changes
  }, [value, isLoading, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    }
  }, [])

  // Auto-resize when value changes (e.g., from voice input)
  useEffect(() => {
    resizeTextarea()
  }, [value, resizeTextarea])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const isVoiceActive = isRecording || isTranscribing

  return (
    <div className={cn('px-4 pb-6 pt-2', className)}>
      <div className="mx-auto max-w-3xl">
        {/* Voice error */}
        {voiceError && (
          <div className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            <span>
              {voiceError.message.includes('authentication') || voiceError.message.includes('API')
                ? 'Please set your OpenOnion API key in Settings'
                : `Error: ${voiceError.message}`}
            </span>
          </div>
        )}

        {/* Voice status indicator */}
        {isVoiceActive && (
          <div className={cn(
            'mb-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm',
            isRecording
              ? 'bg-red-50 text-red-600'
              : 'bg-neutral-100 text-neutral-600'
          )}>
            {isRecording ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
                <span>Recording {formatDuration(duration)}</span>
              </>
            ) : (
              <>
                <LoadingSpinner />
                <span>Transcribing...</span>
              </>
            )}
          </div>
        )}

        <div className={cn(
          'flex items-end gap-3 rounded-2xl border px-4 py-3 transition-all duration-200',
          isRecording
            ? 'border-red-300 bg-red-50'
            : 'border-neutral-200 bg-neutral-50 focus-within:border-neutral-300 focus-within:bg-white focus-within:shadow-sm'
        )}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={resizeTextarea}
            placeholder={isVoiceActive ? '' : placeholder}
            disabled={isLoading || isVoiceActive}
            rows={1}
            className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-[15px] text-neutral-900 placeholder-neutral-400 focus:outline-none disabled:opacity-50 font-medium"
          />

          {/* Mic / Stop button - click to toggle */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || isTranscribing}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all',
              isRecording
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-500/20'
                : isTranscribing
                  ? 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                  : 'text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100'
            )}
          >
            {isTranscribing ? (
              <LoadingSpinner />
            ) : isRecording ? (
              <HiOutlineStop className="h-5 w-5" />
            ) : (
              <HiOutlineMicrophone className="h-5 w-5" />
            )}
          </button>

          {/* Send button */}
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || isLoading || isVoiceActive}
            aria-label="Send message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-all duration-200 hover:bg-neutral-800 active:scale-95 disabled:bg-neutral-100 disabled:text-neutral-300 shadow-sm"
          >
            {isLoading ? <LoadingSpinner /> : <HiOutlineArrowUp className="h-5 w-5 stroke-2" />}
          </button>
        </div>
        {hint && (
          <p className="mt-2 text-center text-[11px] text-neutral-400 font-medium tracking-wide uppercase opacity-70">{hint}</p>
        )}
      </div>
    </div>
  )
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
