'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ToolCallUI, PendingAskUser } from '../../types'
import {
  HiOutlineChevronRight,
  HiOutlineChevronDown,
  HiOutlineQuestionMarkCircle,
  HiOutlineCheckCircle,
  HiOutlineCheck,
  HiOutlinePaperAirplane,
  HiOutlineLockClosed
} from 'react-icons/hi'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { addSecret } from './redact'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Mask by field type OR name — the agent doesn't reliably set type: "password".
function isPasswordField(f: { name: string; type?: string }): boolean {
  return f.type === 'password' || /pass(word|wd)?|secret|pwd/i.test(f.name || '')
}

interface AskUserCardProps {
  toolCall: ToolCallUI
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
  qrImage?: string
}

export function AskUserCard({ toolCall, pendingAskUser, onAskUserResponse, qrImage }: AskUserCardProps) {
  const { args, status, result } = toolCall
  const [isExpanded, setIsExpanded] = useState(true)
  const [selected, setSelected] = useState<string[]>([])
  const [textInput, setTextInput] = useState('')
  const [responded, setResponded] = useState(false)
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [submittedSummary, setSubmittedSummary] = useState<string | null>(null)
  const [zoomed, setZoomed] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const question = (args?.question as string) || ''
  const isPending = !!pendingAskUser && !!onAskUserResponse && status === 'running' && !responded
  const options = pendingAskUser?.options
  const multiSelect = pendingAskUser?.multi_select
  const fields = pendingAskUser?.fields
  const isQr = !!qrImage && !!(options && options.length) && /scan|qr|二维码|扫码/i.test(`${question} ${(options || []).join(' ')}`)

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

  const handleFieldsSubmit = () => {
    if (!isPending || !fields) return
    // Echo a redacted summary in the UI — never the raw password.
    const summary = fields
      .map(f => `${f.label || f.name}: ${isPasswordField(f) ? '••••••' : (fieldValues[f.name] || '')}`)
      .join('\n')
    setSubmittedSummary(summary)
    fields.forEach(f => addSecret(fieldValues[f.name] || ''))
    setResponded(true)
    onAskUserResponse!(JSON.stringify(fieldValues))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const isAwaiting = isPending && !responded

  return (
    <div className="py-2">
      {/* Header */}
      <div
        className="flex items-center gap-2 cursor-pointer group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5 flex-1">
          {isExpanded ? (
            <HiOutlineChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          ) : (
            <HiOutlineChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          )}

          {status === 'done' ? (
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100/50">
              <HiOutlineCheck className="w-2.5 h-2.5 text-green-600" />
            </div>
          ) : responded ? (
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-50">
              <HiOutlineCheck className="w-2.5 h-2.5 text-green-500 animate-pulse" />
            </div>
          ) : isPending ? (
            <div className="w-2 h-2 rounded-full bg-neutral-500 animate-pulse ml-1" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-neutral-900 ml-1" />
          )}

          <HiOutlineQuestionMarkCircle className="w-4 h-4 text-neutral-500 ml-0.5" />
          <span className="text-sm font-semibold text-neutral-700 tracking-tight">Choice Required</span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'done' ? (
            <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest">Completed</span>
          ) : responded ? (
            <span className="text-green-600 text-[10px] uppercase font-bold tracking-widest">Responded</span>
          ) : isAwaiting ? (
            <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest animate-pulse">Pending</span>
          ) : null}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="mt-3 ml-5 space-y-4">
          {/* Question Display */}
          <div className="bg-[#1e1e1e] rounded-xl border border-[#333] overflow-hidden shadow-sm">
            <div className="px-3 py-1.5 bg-[#252525] flex items-center justify-between border-b border-[#333]">
              <span className="text-neutral-500 text-[10px] uppercase tracking-widest font-bold font-mono">Agent Inquiry</span>
              <span className="text-neutral-600 text-[9px] font-mono">ID: {toolCall.id.slice(0, 8)}</span>
            </div>
            <div className="p-4 text-[13px] text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
              {question}
            </div>
          </div>

          {/* Response Interaction Area */}
          {isPending && (
            <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
              {fields && fields.length > 0 ? (
                mounted ? createPortal(
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-5 animate-in zoom-in-95 duration-200">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <div className="w-11 h-11 rounded-full bg-neutral-900 flex items-center justify-center">
                          <HiOutlineLockClosed className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Sign in</h3>
                        {question && <p className="text-xs text-neutral-500 leading-relaxed">{question}</p>}
                      </div>
                      <div className="space-y-3">
                        {fields.map((field, idx) => (
                          <div key={field.name} className="space-y-1.5">
                            <label className="block text-[11px] font-semibold text-neutral-500 capitalize">
                              {field.label || field.name}
                            </label>
                            <input
                              type={isPasswordField(field) ? 'password' : 'text'}
                              autoComplete={field.autocomplete}
                              autoFocus={idx === 0}
                              placeholder={field.placeholder || (isPasswordField(field) ? '••••••••' : '')}
                              value={fieldValues[field.name] || ''}
                              onChange={(e) => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFieldsSubmit() } }}
                              className="w-full bg-neutral-50 px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-400 focus:bg-white focus:ring-4 focus:ring-neutral-500/5 font-medium transition-all"
                            />
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={handleFieldsSubmit}
                        disabled={fields.some(f => f.required !== false && !(fieldValues[f.name] || '').trim())}
                        className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-20 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]"
                      >
                        Sign in
                      </button>
                    </div>
                  </div>,
                  document.body
                ) : null
              ) : isQr ? (
                mounted ? createPortal(
                  zoomed ? (
                    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200" onClick={() => setZoomed(false)}>
                      {qrImage && <img src={qrImage} alt="QR code" className="max-w-full max-h-full object-contain" />}
                    </div>
                  ) : (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-3 text-center animate-in zoom-in-95 duration-200">
                      <h3 className="text-lg font-bold text-neutral-900 tracking-tight">Scan to sign in</h3>
                      {qrImage && <img src={qrImage} alt="QR code" onClick={() => setZoomed(true)} className="w-full rounded-xl border border-neutral-200 cursor-zoom-in" />}
                      <p className="text-[11px] text-neutral-400">Click to enlarge</p>
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
                      </div>
                    </div>
                  </div>
                  ),
                  document.body
                ) : null
              ) : (
              <>
              {options && (
                <div className="grid grid-cols-1 gap-1.5">
                  {options.map((option, idx) => {
                    const isSelected = selected.includes(option)
                    return (
                      <button
                        key={idx}
                        onClick={() => handleOptionClick(option)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all duration-200 border group/item",
                          isSelected
                            ? "bg-neutral-100 text-neutral-900 border-neutral-400 shadow-sm"
                            : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                        )}
                      >
                        <div className="shrink-0">
                          {multiSelect ? (
                            isSelected ? (
                              <HiOutlineCheckCircle className="w-5 h-5 text-neutral-900" />
                            ) : (
                              <div className="w-5 h-5 rounded-full border-2 border-neutral-200 group-hover/item:border-neutral-400 transition-colors" />
                            )
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-neutral-200 group-hover/item:border-neutral-400 transition-colors" />
                          )}
                        </div>
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
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Or provide custom answer</span>
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
              </div>
              </>
              )}
            </div>
          )}

          {/* Show answer when done or responded */}
          {(status === 'done' || responded) && (submittedSummary || result) && (
            <div className="bg-[#272822] rounded-xl border border-[#3E3D32] overflow-hidden shadow-sm animate-in fade-in duration-300">
              <div className="px-3 py-1.5 bg-[#1E1E1E] border-b border-[#3E3D32] flex items-center gap-2">
                <HiOutlineCheck className="w-3 h-3 text-[#A6E22E]" />
                <span className="text-[#75715E] text-[10px] uppercase tracking-wider font-bold font-mono">Response</span>
              </div>
              <pre className="p-4 text-sm text-[#A6E22E] font-mono whitespace-pre-wrap leading-relaxed">
                {submittedSummary || result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
