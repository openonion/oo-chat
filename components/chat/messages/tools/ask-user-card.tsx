'use client'

// In-transcript card for ask_user tool calls: option buttons, free-text reply,
// or QR sign-in modal. QR modal is closable (X/backdrop) and every pending
// state offers ask-user-skip so the agent can proceed without an answer.
import { useState, useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ToolCallUI, PendingAskUser } from '../../types'
import {
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineQuestionMarkCircle,
  HiOutlineCheckCircle,
  HiOutlineCheck,
  HiOutlinePaperAirplane,
  HiOutlineX,
  HiOutlineQrcode
} from 'react-icons/hi'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { ASK_USER_SKIP_ANSWER, SkipButton } from '../../ask-user-skip'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface AskUserCardProps {
  toolCall: ToolCallUI
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
  qrImage?: string
}

export function AskUserCard({ toolCall, pendingAskUser, onAskUserResponse, qrImage }: AskUserCardProps) {
  const selectionHintId = useId()
  const { args, status, result } = toolCall
  const [isExpanded, setIsExpanded] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [textInput, setTextInput] = useState('')
  const [responded, setResponded] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const [qrDismissed, setQrDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  const qrDialogRef = useRef<HTMLDivElement>(null)
  const qrCloseRef = useRef<HTMLButtonElement>(null)
  // Deliberate: the server renders mounted=false and the client flips it after
  // hydration, so browser-only UI below never renders into the server HTML and
  // cannot cause a hydration mismatch. Setting it during render would defeat it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), [])

  const question = (args?.question as string) || ''
  const isPending = !!pendingAskUser && !!onAskUserResponse && status === 'running' && !responded
  const options = pendingAskUser?.options
  const multiSelect = pendingAskUser?.multi_select
  const isQr = !!qrImage && !!(options && options.length) && /scan|qr|二维码|扫码/i.test(`${question} ${(options || []).join(' ')}`)

  useEffect(() => {
    if (!mounted || !isQr || !isPending || qrDismissed) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    qrCloseRef.current?.focus({ preventScroll: true })
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (zoomed) setZoomed(false)
        else setQrDismissed(true)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(qrDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter(element => element.getClientRects().length > 0)
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true })
    }
  }, [mounted, isQr, isPending, qrDismissed, zoomed])

  const handleOptionClick = (option: string) => {
    if (!isPending) return
    if (multiSelect) {
      setSelected(prev =>
        prev.includes(option)
          ? prev.filter(o => o !== option)
          : [...prev, option]
      )
    } else {
      setResponded(true)
      onAskUserResponse!(option)
    }
  }

  const handleSubmit = (customValue?: string) => {
    if (!isPending) return
    
    const valueToSubmit = customValue || textInput.trim()
    
    if (multiSelect && selected.length > 0 && !customValue) {
      setResponded(true)
      onAskUserResponse!(selected)
    } else if (valueToSubmit) {
      setResponded(true)
      onAskUserResponse!(valueToSubmit)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSkip = () => {
    if (!isPending) return
    setSkipped(true)
    setResponded(true)
    onAskUserResponse!(ASK_USER_SKIP_ANSWER)
  }

  const isAwaiting = isPending && !responded

  return (
    <div className="py-2">
      {/* Header */}
      <button
        type="button"
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-2 rounded-md text-left cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="flex items-center gap-1.5 flex-1">
          {isExpanded ? (
            <HiOutlineChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          ) : (
            <HiOutlineChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          )}

          {status === 'done' ? (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-brand-100/50">
              <HiOutlineCheck className="w-2.5 h-2.5 text-brand-600" />
            </span>
          ) : responded ? (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-brand-50">
              <HiOutlineCheck className="w-2.5 h-2.5 text-brand-500 animate-pulse" />
            </span>
          ) : isPending ? (
            <span className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse ml-1" />
          ) : (
            <span className="w-2 h-2 rounded-full bg-neutral-900 ml-1" />
          )}

          <HiOutlineQuestionMarkCircle className="w-4 h-4 text-neutral-500 ml-0.5" />
          <span className="text-sm font-semibold text-neutral-700 tracking-tight">Choice Required</span>
        </span>

        <span className="flex items-center gap-2">
          {status === 'done' ? (
            <span className="text-neutral-400 text-[11px] uppercase font-bold tracking-wide">Completed</span>
          ) : skipped ? (
            <span className="text-neutral-400 text-[11px] uppercase font-bold tracking-wide">Skipped</span>
          ) : responded ? (
            <span className="text-brand-600 text-[11px] uppercase font-bold tracking-wide">Responded</span>
          ) : isAwaiting ? (
            <span className="text-neutral-500 text-[11px] uppercase font-bold tracking-wide animate-pulse">Pending</span>
          ) : null}
        </span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="mt-3 ml-[60px] space-y-4">
          {/* Question */}
          <div className="text-[15px] text-neutral-800 whitespace-pre-wrap leading-relaxed">
            {question}
          </div>

          {/* Response Interaction Area */}
          {isPending && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              {isQr && !qrDismissed ? (
                mounted ? createPortal(
                  zoomed ? (
                    <div ref={qrDialogRef} role="dialog" aria-modal="true" aria-label="Enlarged sign-in QR code" className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setZoomed(false)}>
                      {/* Attachments arrive as base64 data: URLs in the event stream. next/image
                          cannot optimise those — it needs a routable URL or a static import — so
                          plain <img> is correct here, not a shortcut. */}
                      <button ref={qrCloseRef} type="button" aria-label="Close enlarged QR code" className="flex max-h-full max-w-full cursor-zoom-out items-center justify-center" onClick={() => setZoomed(false)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {qrImage && <img src={qrImage} alt="QR code" className="max-w-full max-h-full object-contain" />}
                      </button>
                    </div>
                  ) : (
                  <div
                    ref={qrDialogRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Scan to sign in"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => setQrDismissed(true)}
                  >
                    <div
                      className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-3 text-center animate-in zoom-in-95 duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        ref={qrCloseRef}
                        type="button"
                        aria-label="Close sign-in dialog"
                        onClick={() => setQrDismissed(true)}
                        className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-all"
                      >
                        <HiOutlineX className="w-4 h-4" />
                      </button>
                      <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Scan to sign in</h3>
                      {/* Attachments arrive as base64 data: URLs in the event stream. next/image
                          cannot optimise those — it needs a routable URL or a static import — so
                          plain <img> is correct here, not a shortcut. */}
                      {qrImage && (
                        <button type="button" aria-label="Enlarge QR code" onClick={() => setZoomed(true)} className="w-full cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrImage} alt="QR code" className="w-full rounded-xl border border-neutral-200" />
                        </button>
                      )}
                      <p className="text-[11px] text-neutral-500">Select the QR code to enlarge it</p>
                      {question && <p className="text-xs text-neutral-500 leading-relaxed">{question}</p>}
                      <div className="space-y-2">
                        {(options || []).map((option, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleOptionClick(option)}
                            className="w-full bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-bold py-2.5 rounded-xl transition-all active:scale-[0.99]"
                          >
                            {option}
                          </button>
                        ))}
                        <SkipButton onSkip={handleSkip} />
                      </div>
                    </div>
                  </div>
                  ),
                  document.body
                ) : null
              ) : (
              <>
              {isQr && (
                <button
                  onClick={() => setQrDismissed(false)}
                  className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
                >
                  <HiOutlineQrcode className="w-4 h-4" />
                  Show QR code
                </button>
              )}
              {options && (
                <div className="grid grid-cols-1 gap-1.5">
                  {!multiSelect && <p id={selectionHintId} className="px-1 pb-1 text-xs text-neutral-500">Selecting an option sends it immediately.</p>}
                  {options.map((option, idx) => {
                    const isSelected = selected.includes(option)
                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-pressed={multiSelect ? isSelected : undefined}
                        aria-describedby={multiSelect ? undefined : selectionHintId}
                        onClick={() => handleOptionClick(option)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all duration-200 border group/item",
                          isSelected
                            ? "bg-neutral-100 text-neutral-900 border-neutral-400 shadow-sm"
                            : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                        )}
                      >
                        <span className="shrink-0">
                          {multiSelect ? (
                            isSelected ? (
                              <HiOutlineCheckCircle className="w-5 h-5 text-neutral-900" />
                            ) : (
                              <span className="block w-5 h-5 rounded-full border-2 border-neutral-200 group-hover/item:border-neutral-400 transition-colors" />
                            )
                          ) : (
                            <span className="block w-5 h-5 rounded-full border-2 border-neutral-200 group-hover/item:border-neutral-400 transition-colors" />
                          )}
                        </span>
                        <span className={cn(
                          "text-sm",
                          isSelected ? "font-semibold" : "font-medium text-neutral-600"
                        )}>
                          {option}
                        </span>
                      </button>
                    )
                  })}

                  {multiSelect && (
                    <div className="mt-1 flex justify-end">
                      <button
                        onClick={() => handleSubmit()}
                        disabled={selected.length === 0}
                        className="flex items-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-20 text-white text-xs font-bold px-6 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
                      >
                        Submit {selected.length > 0 && `(${selected.length})`}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Input Fallback (always show or show if no options) */}
              <div className="space-y-2">
                {options && (
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-px flex-1 bg-neutral-100" />
                    <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wide">Or provide custom answer</span>
                    <div className="h-px flex-1 bg-neutral-100" />
                  </div>
                )}
                
                <div className="flex gap-2 bg-white p-1.5 rounded-xl border border-neutral-200 shadow-sm focus-within:border-neutral-400 focus-within:ring-4 focus-within:ring-neutral-500/5 transition-all">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={options ? "Something else..." : "Type your answer..."}
                    className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-neutral-400 font-medium"
                    autoFocus={!options}
                  />
                  <button
                    onClick={() => handleSubmit()}
                    disabled={!textInput.trim()}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-10 transition-all shadow-sm active:scale-90"
                    title="Send custom answer"
                  >
                    <HiOutlinePaperAirplane className="w-4 h-4 rotate-90" />
                  </button>
                </div>
                <SkipButton onSkip={handleSkip} />
              </div>
              </>
              )}
            </div>
          )}

          {/* Answer */}
          {(status === 'done' || responded) && result && (
            <div className="flex items-start gap-2 text-sm text-neutral-600 animate-in fade-in duration-300">
              <HiOutlineCheck className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap leading-relaxed">{result}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
