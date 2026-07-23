'use client'

// Standalone ask_user prompt rendered outside the tool-call card flow (used by
// the chat input area when the agent is waiting). Same skip semantics as the
// cards via ask-user-skip.

import { useState } from 'react'
import {
  HiOutlineCheckCircle,
  HiOutlineCheck,
  HiOutlinePaperAirplane,
  HiOutlineQuestionMarkCircle
} from 'react-icons/hi'
import { cn } from './utils'
import { ASK_USER_SKIP_ANSWER, SkipButton } from './ask-user-skip'
import { askUserOptionLabel, isAskUserOptionDisabled } from './ask-user-options'
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
  const disabledOptions = new Set(
    Array.isArray(askUser.disabled_options) ? askUser.disabled_options : []
  )
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
    if (isAskUserOptionDisabled(option, disabledOptions)) return
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
      'mx-4 mb-5 max-w-xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm animate-in fade-in slide-in-from-bottom-3 duration-500',
      className
    )}>
      {/* Header-like question area */}
      <div className="border-b border-neutral-100 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-neutral-50">
            <HiOutlineQuestionMarkCircle className="h-4 w-4 text-neutral-500" />
          </div>
          <p className="min-w-0 text-sm font-medium leading-6 text-neutral-800">{question}</p>
        </div>
      </div>

      {/* Input area */}
      <div className="space-y-4 p-4">
        {hasFieldForm ? (
          <div className="space-y-3">
            {formFields.map(field => (
              <label key={field.name} className="block space-y-1.5">
                <span className="text-xs font-medium text-neutral-600">{field.label}</span>
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={fieldValues[field.name] || ''}
                  onChange={(e) => setFieldValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  placeholder={field.placeholder || field.label}
                  autoComplete={field.autocomplete}
                  className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-3 focus:ring-neutral-900/5"
                  autoFocus={field.name === formFields[0]?.name}
                />
              </label>
            ))}

            <div className="flex justify-end pt-1">
              <button
                onClick={handleFieldSubmit}
                disabled={hasMissingRequiredField}
                className="flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 active:scale-95"
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
                const isDisabled = isAskUserOptionDisabled(option, disabledOptions)
                return (
                  <button
                    key={idx}
                    onClick={() => handleOptionClick(option)}
                    disabled={isDisabled}
                    aria-disabled={isDisabled}
                    className={cn(
                      'group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-all duration-200',
                      isDisabled
                        ? 'cursor-not-allowed border-neutral-100 bg-neutral-50 text-neutral-400 opacity-70'
                        : isSelected
                        ? 'border-neutral-300 bg-neutral-50 text-neutral-900'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900'
                    )}
                  >
                    <div className="shrink-0">
                      {isDisabled ? (
                        <div className="h-5 w-5 rounded-full border-2 border-neutral-200 bg-neutral-100" />
                      ) : multi_select ? (
                        isSelected ? (
                          <HiOutlineCheckCircle className="w-5 h-5 text-neutral-900" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-neutral-200 transition-colors group-hover:border-neutral-400" />
                        )
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-neutral-200 transition-colors group-hover:border-neutral-400" />
                      )}
                    </div>
                    <span className={cn(isSelected ? 'font-bold' : 'font-medium')}>
                      {askUserOptionLabel(option)}
                    </span>
                  </button>
                )
              })}
            </div>

            {multi_select && (
              <div className="mt-4 flex items-center justify-between border-t border-neutral-100 px-1 pt-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                  {selected.length === 0
                    ? "Select options"
                    : `${selected.length} selected`}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={selected.length === 0}
                  className="flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 active:scale-95"
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
              <div className="h-px flex-1 bg-neutral-100" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">Or enter custom value</span>
              <div className="h-px flex-1 bg-neutral-100" />
            </div>
          )}

          <div className="flex gap-2 rounded-md border border-neutral-200 bg-white p-1.5 transition-all focus-within:border-neutral-400 focus-within:ring-3 focus-within:ring-neutral-900/5">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasOptions ? "Custom answer..." : "Type your answer..."}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
              autoFocus={!hasOptions}
            />
            <button
              onClick={handleSubmit}
              disabled={!textInput.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-md bg-neutral-900 text-white transition-all hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 active:scale-90"
            >
              <HiOutlinePaperAirplane className="w-5 h-5 rotate-90" />
            </button>
          </div>
        </div>
        )}

        <SkipButton onSkip={() => onResponse(ASK_USER_SKIP_ANSWER)} />
      </div>
    </div>
  )
}
