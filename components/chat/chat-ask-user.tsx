'use client'

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
  const { multi_select, input_type, fields } = askUser
  const question = typeof askUser.question === 'string' ? askUser.question : ''
  const options = Array.isArray(askUser.options) ? askUser.options : []
  const [selected, setSelected] = useState<string[]>([])
  const [textInput, setTextInput] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const hasOptions = options.length > 0
  const isCredentialPrompt = input_type === 'credentials' || question.includes('账号和密码') || question.includes('账号或密码')
  const formFields = fields && fields.length > 0
    ? fields
    : isCredentialPrompt
      ? [
          { name: 'username', label: '账号', type: 'text' as const, required: true, autocomplete: 'username' },
          { name: 'password', label: '密码', type: 'password' as const, required: true, autocomplete: 'current-password' },
        ]
      : []
  const hasFieldForm = formFields.length > 0
  const hasMissingRequiredField = formFields.some(field => field.required && !fieldValues[field.name]?.trim())

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

  const handleFieldSubmit = () => {
    if (hasMissingRequiredField) return

    const answer = formFields.reduce<Record<string, string>>((acc, field) => {
      acc[field.name] = fieldValues[field.name]?.trim() || ''
      return acc
    }, {})
    onResponse(JSON.stringify(answer))
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (hasFieldForm) {
        handleFieldSubmit()
      } else {
        handleSubmit()
      }
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
        {hasFieldForm ? (
          <div className="space-y-3">
            {formFields.map(field => (
              <label key={field.name} className="block space-y-1.5">
                <span className="text-xs font-semibold text-amber-950">{field.label}</span>
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={fieldValues[field.name] || ''}
                  onChange={(e) => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  placeholder={field.placeholder || field.label}
                  autoComplete={field.autocomplete}
                  className="w-full rounded-xl border border-amber-100 bg-white px-3 py-3 text-sm font-medium text-neutral-900 shadow-sm outline-none transition-all placeholder:text-neutral-400 focus:border-amber-300 focus:ring-4 focus:ring-amber-500/5"
                  autoFocus={field.name === formFields[0]?.name}
                />
              </label>
            ))}

            <div className="flex justify-end pt-1">
              <button
                onClick={handleFieldSubmit}
                disabled={hasMissingRequiredField}
                className="flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:bg-neutral-800 disabled:opacity-20 active:scale-95"
              >
                <HiOutlinePaperAirplane className="w-4 h-4 rotate-90" />
                提交
              </button>
            </div>
          </div>
        ) : hasOptions && (
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
        {!hasFieldForm && (
        <div className="space-y-3 pt-1">
          {hasOptions && (
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
              placeholder={hasOptions ? "Custom answer..." : "Type your answer..."}
              className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none placeholder:text-neutral-400 text-neutral-900 font-medium"
              autoFocus={!hasOptions}
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
        )}
      </div>
    </div>
  )
}
