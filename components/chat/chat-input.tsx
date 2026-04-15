'use client'

/**
 * @purpose Auto-resizing textarea message input with voice input and keyboard shortcuts
 */

import { useState, useRef, useCallback, useEffect, useMemo, KeyboardEvent, ChangeEvent } from 'react'
import { HiOutlineArrowUp, HiOutlineMicrophone, HiOutlineStop, HiX } from 'react-icons/hi'
import { HiOutlinePlus, HiOutlineDocument } from 'react-icons/hi2'
import { useVoiceInput } from 'connectonion/react'
import { useChatStore } from '@/store/chat-store'
import { cn } from './utils'
import type { ChatInputProps, FileAttachment } from './types'

// Commands that take arguments get a trailing space inserted after selection
const COMMANDS_WITH_ARGS = new Set(['/search', '/inbox', '/events'])

// Unified dropdown entry — built from hardcoded slashCommands + dynamic skills from /info
interface UnifiedCommand {
  id: string      // e.g. "/today"
  label: string   // description text
  prefix?: string // optional emoji
}

export function ChatInput({
  onSend,
  isLoading = false,
  placeholder = 'Message...',
  statusBar,
  className,
  slashCommands,
  skills,
}: ChatInputProps) {
  const [value, setValue] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [files, setFiles] = useState<FileAttachment[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const commandRefs = useRef<(HTMLButtonElement | null)[]>([])
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

  // Merge hardcoded slashCommands and dynamic skills into a single list.
  // Hardcoded entries win on collision (they carry curated emoji + label).
  const allCommands = useMemo<UnifiedCommand[]>(() => {
    const result: UnifiedCommand[] = []
    const seen = new Set<string>()
    if (slashCommands) {
      for (const c of slashCommands) {
        result.push({ id: c.id, label: c.label, prefix: c.prefix })
        seen.add(c.id)
      }
    }
    if (skills) {
      for (const s of skills) {
        const id = '/' + s.name
        if (!seen.has(id)) {
          result.push({ id, label: s.description || '' })
          seen.add(id)
        }
      }
    }
    return result
  }, [slashCommands, skills])

  const filteredCommands = useMemo(() => {
    if (!value.startsWith('/')) return []
    const query = value.toLowerCase().split(' ')[0]
    return allCommands.filter(cmd => cmd.id.toLowerCase().startsWith(query))
  }, [value, allCommands])

  const showDropdown = filteredCommands.length > 0

  // Reset selection when filtered list changes
  useEffect(() => {
    setSelectedIndex(-1)
  }, [filteredCommands.length])

  // Scroll selected command into view
  useEffect(() => {
    if (selectedIndex >= 0) {
      commandRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const selectCommand = useCallback((cmd: UnifiedCommand) => {
    const needsArgs = COMMANDS_WITH_ARGS.has(cmd.id)
    setValue(needsArgs ? `${cmd.id} ` : cmd.id)
    setSelectedIndex(-1)
    textareaRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if ((!trimmed && images.length === 0 && files.length === 0) || isLoading) return

    onSend(
      trimmed,
      images.length > 0 ? images : undefined,
      files.length > 0 ? files : undefined,
    )
    setValue('')
    setImages([])
    setFiles([])
    // Height resets automatically via useEffect when value changes
  }, [value, images, files, isLoading, onSend])

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (!selected) return

    Array.from(selected).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        if (file.type.startsWith('image/')) {
          setImages(prev => [...prev, dataUrl])
        } else {
          setFiles(prev => [...prev, { name: file.name, type: file.type, size: file.size, dataUrl }])
        }
      }
      reader.readAsDataURL(file)
    })
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [])

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showDropdown) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev =>
          prev <= 0 ? filteredCommands.length - 1 : prev - 1
        )
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        selectCommand(filteredCommands[selectedIndex >= 0 ? selectedIndex : 0])
        return
      }
      if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault()
        selectCommand(filteredCommands[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setSelectedIndex(-1)
        setValue('')
        return
      }
    }
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
      <div className="mx-auto max-w-3xl relative">
        {/* Unified slash command + skill dropdown */}
        {showDropdown && (
          <div className="absolute bottom-full mb-2 left-0 right-0 z-50 rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden max-h-60 overflow-y-auto">
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.id}
                ref={el => { commandRefs.current[i] = el }}
                onMouseDown={(e) => { e.preventDefault(); selectCommand(cmd) }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                  i === selectedIndex
                    ? 'bg-neutral-100 text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-50'
                )}
              >
                {cmd.prefix && <span className="text-base leading-none">{cmd.prefix}</span>}
                <span className="font-medium text-neutral-900">{cmd.id}</span>
                <span className="text-neutral-500 truncate">{cmd.label}</span>
              </button>
            ))}
            <div className="border-t border-neutral-100 px-4 py-1.5 text-[10px] text-neutral-400">
              <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1">↑↓</kbd> navigate · <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1">Tab</kbd> complete · <kbd className="rounded border border-neutral-200 bg-neutral-50 px-1">Esc</kbd> dismiss
            </div>
          </div>
        )}

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

        {/* File previews */}
        {files.length > 0 && (
          <div className="mb-3 flex gap-2 flex-wrap">
            {files.map((file, i) => (
              <div key={i} className="relative group flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 shadow-sm">
                <HiOutlineDocument className="h-4 w-4 text-neutral-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-neutral-700 truncate max-w-[150px]">{file.name}</div>
                  <div className="text-[11px] text-neutral-400">{formatFileSize(file.size)}</div>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="ml-1 h-5 w-5 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-neutral-200 hover:text-neutral-600"
                  aria-label="Remove file"
                >
                  <HiX className="h-3 w-3" />
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
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* File picker button - always available */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isVoiceActive}
              aria-label="Attach file"
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
              disabled={(!value.trim() && images.length === 0 && files.length === 0) || isVoiceActive}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white transition-all duration-200 hover:bg-neutral-800 active:scale-95 disabled:bg-neutral-100 disabled:text-neutral-300 shadow-sm"
            >
              <HiOutlineArrowUp className="h-5 w-5 stroke-2" />
            </button>
          </div>

          {/* Mode bar - inside container */}
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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