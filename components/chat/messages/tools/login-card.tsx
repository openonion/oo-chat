'use client'

// Credential prompt for ask_user calls that carry fields (e.g. /linkedin-login).
// Renders a masked-input modal (values registered with redact.ts so they never
// echo in the transcript); closable via X/backdrop and skippable via
// ask-user-skip — the chat must never deadlock on an unanswered prompt.
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ToolCallUI, PendingAskUser } from '../../types'
import { HiOutlineLockClosed, HiOutlineCheck, HiOutlineX } from 'react-icons/hi'
import { addSecret } from './redact'
import { ASK_USER_SKIP_ANSWER, SkipButton } from '../../ask-user-skip'

// Mask by field type OR name — the model doesn't reliably set type: "password".
function isPasswordField(f: { name: string; type?: string }): boolean {
  return f.type === 'password' || /pass(word|wd)?|secret|pwd/i.test(f.name || '')
}

interface LoginCardProps {
  toolCall: ToolCallUI
  pendingAskUser?: PendingAskUser | null
  onAskUserResponse?: (answer: string | string[]) => void
}

// Login is handled separately from ask_user: a pop-up form, and the transcript
// only ever shows a compact status — never the credentials or the raw answer.
export function LoginCard({ toolCall, pendingAskUser, onAskUserResponse }: LoginCardProps) {
  const { args, status } = toolCall
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [responded, setResponded] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const question = (args?.question as string) || ''
  const fields = pendingAskUser?.fields
  const isPending = !!pendingAskUser && !!onAskUserResponse && status === 'running' && !responded && !!fields

  const handleSubmit = () => {
    if (!isPending || !fields) return
    // Mark every entered value as a secret so it's redacted in later tool args.
    fields.forEach(f => addSecret(fieldValues[f.name] || ''))
    setResponded(true)
    onAskUserResponse!(JSON.stringify(fieldValues))
  }

  const handleSkip = () => {
    if (!isPending) return
    setSkipped(true)
    setResponded(true)
    onAskUserResponse!(ASK_USER_SKIP_ANSWER)
  }

  const done = status === 'done' || responded

  return (
    <>
      <div
        className={`flex items-center gap-2 py-2 text-sm ${isPending && dismissed ? 'cursor-pointer' : ''}`}
        onClick={isPending && dismissed ? () => setDismissed(false) : undefined}
      >
        <div className={`flex items-center justify-center w-5 h-5 rounded-full ${done && !skipped ? 'bg-green-100/60' : 'bg-neutral-100'}`}>
          {skipped
            ? <HiOutlineX className="w-3 h-3 text-neutral-500" />
            : done
              ? <HiOutlineCheck className="w-3 h-3 text-green-600" />
              : <HiOutlineLockClosed className="w-3 h-3 text-neutral-500" />}
        </div>
        <span className="font-medium text-neutral-600">
          {skipped ? 'Skipped' : done ? 'Credentials provided' : 'Sign-in requested'}
        </span>
        {isPending && dismissed && (
          <span className="text-xs text-neutral-400 underline">open</span>
        )}
      </div>

      {isPending && mounted && fields && !dismissed && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setDismissed(true)}
        >
          <div
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDismissed(true)}
              className="absolute top-3 right-3 p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-all"
            >
              <HiOutlineX className="w-4 h-4" />
            </button>
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
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                    className="w-full bg-neutral-50 px-3.5 py-2.5 text-sm rounded-xl border border-neutral-200 focus:outline-none focus:border-neutral-400 focus:bg-white focus:ring-4 focus:ring-neutral-500/5 font-medium transition-all"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={handleSubmit}
              disabled={fields.some(f => f.required !== false && !(fieldValues[f.name] || '').trim())}
              className="w-full flex items-center justify-center gap-2 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-20 text-white text-sm font-bold py-3 rounded-xl transition-all shadow-sm active:scale-[0.99]"
            >
              Sign in
            </button>
            <SkipButton onSkip={handleSkip} />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
