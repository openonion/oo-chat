'use client'

/**
 * Shared voice-input presentation for the outer composer and native-provider
 * Work Room composers. The caller owns the draft and the send boundary.
 */
import { HiOutlineMicrophone, HiOutlineStop } from 'react-icons/hi'
import { useVoiceInput } from '@connectonion/react'
import { useEffect } from 'react'
import { cn } from './utils'

export type ComposerVoiceState = ReturnType<typeof useVoiceInput>

export function useComposerVoiceInput({
  apiKey,
  onTranscribed,
}: {
  apiKey?: string
  onTranscribed: (text: string) => void
}) {
  const voice = useVoiceInput({
    apiKey,
    onTranscribed,
    onError: error => console.error('Voice input error:', error),
  })
  const { cancelRecording } = voice
  useEffect(() => () => cancelRecording(), [cancelRecording])
  return voice
}

export function ComposerVoiceFeedback({ voice }: { voice: ComposerVoiceState }) {
  const { error, isRecording, isTranscribing, duration } = voice
  if (error) {
    return (
      <div role="alert" className="mb-2 flex items-center justify-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
        <span>{voiceErrorMessage(error)}</span>
      </div>
    )
  }
  if (!isRecording && !isTranscribing) return null
  return (
    <div
      role="status"
      className={cn(
        'mb-2 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm',
        isRecording ? 'bg-red-50 text-red-600' : 'bg-neutral-100 text-neutral-600',
      )}
    >
      {isRecording ? (
        <>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
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
  )
}

export function ComposerVoiceButton({
  voice,
  disabled = false,
  owner,
  large = false,
}: {
  voice: ComposerVoiceState
  disabled?: boolean
  owner?: string
  large?: boolean
}) {
  const { isRecording, isTranscribing, startRecording, stopRecording } = voice
  const action = isRecording ? 'Stop' : 'Start'
  const label = owner
    ? `${action} ${owner} voice input`
    : isRecording ? 'Stop recording' : 'Start recording'
  return (
    <button
      type="button"
      onClick={isRecording ? stopRecording : startRecording}
      disabled={disabled || isTranscribing}
      aria-label={label}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-xl transition-all',
        large ? 'h-11 w-11' : 'h-9 w-9',
        isRecording
          ? 'bg-red-500 text-white shadow-md shadow-red-500/20 hover:bg-red-600'
          : isTranscribing
            ? 'cursor-not-allowed bg-neutral-100 text-neutral-400'
            : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600',
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
  )
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function voiceErrorMessage(error: Error): string {
  const name = (error as DOMException).name
  const text = error.message || ''
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone found. Connect one, or type your message instead.'
  }
  if (name === 'NotReadableError') {
    return 'The microphone is in use by another app. Close it and try again.'
  }
  if (name === 'NotAllowedError' || /permission|denied/i.test(text)) {
    return 'Microphone blocked. Allow microphone access for this site in your browser settings, then try again.'
  }
  if (/authentication/i.test(text) || /API/.test(text)) {
    return 'Please set your OpenOnion API key in Settings'
  }
  return `Error: ${text}`
}
