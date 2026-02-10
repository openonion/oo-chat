'use client'

import { useState, useEffect, useRef } from 'react'
import type { OnboardRequiredUI } from '../types'
import { HiOutlineLockClosed, HiOutlineTicket, HiOutlineCreditCard, HiOutlineArrowRight, HiOutlineCheckCircle } from 'react-icons/hi'

const SUBMIT_TIMEOUT_MS = 30_000

interface OnboardRequiredProps {
  data: OnboardRequiredUI
  onSubmit: (options: { inviteCode?: string; payment?: number }) => void
  isCompleted?: boolean
}

export function OnboardRequired({ data, onSubmit, isCompleted = false }: OnboardRequiredProps) {
  const [inviteCode, setInviteCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasInviteCode = data.methods.includes('invite_code')
  const hasPayment = data.methods.includes('payment')

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  // Reset submitting state on success
  useEffect(() => {
    if (isCompleted) {
      setIsSubmitting(false)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [isCompleted])

  const startSubmitTimeout = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setIsSubmitting(false)
      setError('Verification timed out. Please try again.')
    }, SUBMIT_TIMEOUT_MS)
  }

  const handleInviteSubmit = () => {
    if (inviteCode.trim()) {
      setIsSubmitting(true)
      setError(null)
      startSubmitTimeout()
      try {
        onSubmit({ inviteCode: inviteCode.trim() })
      } catch {
        setIsSubmitting(false)
        setError('Failed to submit. Please try again.')
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    }
  }

  const handlePaymentSubmit = () => {
    if (data.paymentAmount) {
      setIsSubmitting(true)
      setError(null)
      startSubmitTimeout()
      try {
        onSubmit({ payment: data.paymentAmount })
      } catch {
        setIsSubmitting(false)
        setError('Failed to submit. Please try again.')
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      }
    }
  }

  // After verification completed, show collapsed state
  if (isCompleted) {
    return (
      <div className="flex justify-start py-2">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 text-neutral-500 text-sm">
          <HiOutlineCheckCircle className="w-4 h-4" />
          <span>Verification completed</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start py-2">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100">
            <HiOutlineLockClosed className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <div className="text-sm font-semibold text-neutral-900">
              Verification Required
            </div>
            <div className="text-xs text-neutral-500">
              Complete one of the options below to continue
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
          {hasInviteCode && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <HiOutlineTicket className="w-4 h-4 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-700">Invite Code</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Enter your invite code"
                  disabled={isSubmitting}
                  className="flex-1 px-3.5 py-2.5 text-sm rounded-lg border border-neutral-200 bg-neutral-50 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-neutral-900 focus:border-transparent disabled:opacity-50 transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleInviteSubmit()}
                />
                <button
                  onClick={handleInviteSubmit}
                  disabled={!inviteCode.trim() || isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Verifying</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <HiOutlineArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {hasInviteCode && hasPayment && (
            <div className="flex items-center px-4">
              <div className="flex-1 h-px bg-neutral-200" />
              <span className="px-3 text-xs text-neutral-400 font-medium uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-neutral-200" />
            </div>
          )}

          {hasPayment && data.paymentAmount && (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <HiOutlineCreditCard className="w-4 h-4 text-neutral-400" />
                <span className="text-sm font-medium text-neutral-700">One-time Payment</span>
              </div>
              {data.paymentAddress && (
                <div className="mb-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                  <div className="text-xs text-neutral-500 mb-1">Transfer ${data.paymentAmount} to:</div>
                  <div className="font-mono text-xs text-neutral-700 break-all select-all">
                    {data.paymentAddress}
                  </div>
                </div>
              )}
              <button
                onClick={handlePaymentSubmit}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-neutral-700 bg-neutral-100 border border-neutral-200 rounded-lg hover:bg-neutral-200 hover:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>I&apos;ve transferred ${data.paymentAmount}</span>
                )}
              </button>
            </div>
          )}

          {/* Error message with retry */}
          {error && (
            <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-sm text-red-600 flex items-center justify-between gap-2">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="shrink-0 text-xs font-medium text-red-700 underline hover:text-red-800"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
