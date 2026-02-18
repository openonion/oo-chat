'use client'

/**
 * @purpose Auto-resizing textarea message input with voice input and keyboard shortcuts
 */

import { useState, useRef, useCallback, useEffect, KeyboardEvent, ChangeEvent } from 'react'
import { HiOutlineArrowUp, HiOutlineMicrophone, HiOutlineStop, HiX } from 'react-icons/hi'
import { HiOutlinePlus } from 'react-icons/hi2'
import { useVoiceInput } from 'connectonion/react'
import { useChatStore } from '@/store/chat-store'
import { cn } from './utils'
import type { ChatInputProps } from './types'

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Message...',
  statusBar,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [images, setImages] = useState<string[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
    if ((!trimmed && images.length === 0) || isLoading) return

    onSend(trimmed, images.length > 0 ? images : undefined)
    setValue('')
    setImages([])
    // Height resets automatically via useEffect when value changes
  }, [value, images, isLoading, onSend])

  const handleImageSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        setImages(prev => [...prev, dataUrl])
      }
      reader.readAsDataURL(file)
    })
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [])

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }, [])

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

        {/* Image previews */}
        {images.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group">
                <img
                  src={img}
                  alt={`Upload ${i + 1}`}
                  className="h-20 w-20 object-cover rounded-xl shadow-sm"
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-neutral-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-neutral-700"
                  aria-label="Remove image"
                >
                  <HiX className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={cn(
          'rounded-2xl border transition-all duration-200',
          isRecording
            ? 'border-red-300 bg-red-50'
            : 'border-neutral-200 bg-neutral-50 focus-within:border-neutral-300 focus-within:bg-white focus-within:shadow-sm'
        )}>
          {/* Input row */}
          <div className="flex items-end gap-3 px-4 py-3">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Image picker button - always available */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isVoiceActive}
              aria-label="Attach image"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 hover:text-neutral-700 hover:border-neutral-400 hover:bg-white transition-all disabled:opacity-50"
            >
              <HiOutlinePlus className="h-4 w-4 stroke-[2.5]" />
            </button>

            {/* Textarea - always available so user can type during execution */}
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={resizeTextarea}
              placeholder={isVoiceActive ? '' : placeholder}
              disabled={isVoiceActive}
              rows={1}
              className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-1.5 text-[15px] text-neutral-900 placeholder-neutral-400 focus:outline-none disabled:opacity-50 font-medium"
            />

            {/* Mic / Stop button - click to toggle */}
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing}
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

            {/* Send button - always available so user can send during execution */}
            <button
              onClick={handleSubmit}
              disabled={(!value.trim() && images.length === 0) || isVoiceActive}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-all duration-200 hover:bg-neutral-800 active:scale-95 disabled:bg-neutral-100 disabled:text-neutral-300 shadow-sm"
            >
              <HiOutlineArrowUp className="h-5 w-5 stroke-2" />
            </button>
          </div>

          {/* Status bar - integrated inside container */}
          {statusBar && (
            <div className="border-t border-neutral-100 px-4 py-2">
              {statusBar}
            </div>
          )}
        </div>
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
