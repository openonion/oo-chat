/**
 * @purpose Stand in front of an invite-only agent: the code is the only thing on
 *   screen until it is accepted.
 * @llm-note The old order was: composer → reader types → connect → agent refuses →
 *   an onboard card appears in the transcript → the message they wrote is gone
 *   (#27). Every part of that is avoidable, because the host already answers the
 *   question on CONNECT: it verifies the caller's signature and replies
 *   ONBOARD_REQUIRED before a single message is sent. The landing page opens that
 *   socket eagerly for the dashboard snapshot, so the answer was arriving all along
 *   — it was just being filed into the transcript instead of read.
 *
 *   Driven by that frame, not by `/info.onboard`. `/info` is anonymous: it states
 *   the agent's policy and tells an admin exactly what it tells a stranger, so
 *   gating on it puts a code prompt in front of people who hold the keys. CONNECT
 *   is per-caller and authenticated, which is the question actually being asked.
 *
 *   This used to be an inline card that sat below the example chips, deliberately
 *   not a wall — the argument being that name, model and skills are what convince
 *   someone to go and ask for a code. On a phone that argument lost to arithmetic.
 *   Measured at 375×667: header and avatar ≈ 240px, three rows of chips ≈ 190px,
 *   and the card's title landed near y≈470 of a ~600px viewport. The one thing a
 *   visitor must do was the fourth thing they could see, under a filled black
 *   button that, while gated, does nothing but move focus.
 *
 *   So it is a wall now. The pitch is not gone — it is the first thing behind the
 *   code, one submit away — but a page that requires a code opens by asking for
 *   the code. Nothing else on screen is actionable until it is answered, which is
 *   also the honest rendering of the state: every control behind this would be
 *   refused.
 *
 *   The in-transcript OnboardRequired card stays as-is. It is still correct for the
 *   case this cannot cover — an agent that starts open and gates mid-session, where
 *   there is a conversation behind it that must stay readable.
 */
'use client'

import { forwardRef, useEffect, useRef, useState } from 'react'
import { HiOutlineTicket, HiOutlineArrowRight, HiOutlineCreditCard, HiOutlineExclamationCircle } from 'react-icons/hi'
import type { PendingOnboard } from './types'

interface OnboardGateProps {
  onboard: PendingOnboard
  agentName: string
  onSubmit: (options: { inviteCode?: string; payment?: number }) => void
  isSubmitting?: boolean
  error?: string | null
}

// The ref is the code field, so a suggestion chip can hand the reader straight to it
// instead of navigating into a conversation the agent would refuse.
export const OnboardGate = forwardRef<HTMLInputElement, OnboardGateProps>(function OnboardGate({
  onboard, agentName, onSubmit, isSubmitting = false, error = null,
}, ref) {
  const [code, setCode] = useState('')
  const [emptyWarning, setEmptyWarning] = useState(false)
  const takesCode = onboard.methods.includes('invite_code')
  const price = onboard.methods.includes('payment') ? onboard.paymentAmount ?? 0 : null
  const shown = error ?? (emptyWarning ? 'Enter your invite code.' : null)

  const panelRef = useRef<HTMLDivElement>(null)

  // Hold Tab inside the panel. There is nothing behind this worth reaching — every
  // control back there is one the agent would refuse — and a keyboard user who tabs
  // out of a wall lands in a page they cannot see and cannot use.
  //
  // No Escape handler on purpose: dismissing leaves nothing usable, so a key that
  // looks like it should close this would either lie or do nothing visible. The
  // honest answer to "can I get out of this" is the last line of the panel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'input:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    // The page behind still scrolls on iOS otherwise, under an overlay that looks fixed.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [])

  return (
    // Opaque, not a dim scrim. Content you can read through a veil but cannot touch
    // is its own frustration, and half-hiding an agent's skills says "look at what
    // you may not have" — which is the opposite of what the line at the bottom is
    // trying to do for someone who has no code.
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto
                 bg-neutral-50 px-5 py-8 dark:bg-neutral-950"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-gate-title"
        aria-describedby="onboard-gate-sub"
        className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl
                   shadow-neutral-900/5"
      >
        <div className="mb-1 flex items-center gap-2">
          <HiOutlineTicket className="h-4 w-4 text-neutral-400" />
          {/* Matches the hero's rule: a real name gets the display serif, a raw
              address is data and stays mono. */}
          <h2
            id="onboard-gate-title"
            className={`text-base font-semibold text-neutral-900 ${/^0x/.test(agentName) ? 'font-mono' : ''}`}
          >
            {agentName} is invite-only
          </h2>
        </div>
        <p id="onboard-gate-sub" className="mb-5 text-sm text-neutral-500">
          Enter your code to start talking.
        </p>

        {takesCode && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (isSubmitting) return
              // Validate on submit rather than disabling the button: a greyed-out control
              // makes the reader guess why it will not move, and an invite code is exactly
              // the field where someone pastes whitespace and sees nothing happen.
              if (!code.trim()) { setEmptyWarning(true); return }
              setEmptyWarning(false)
              onSubmit({ inviteCode: code.trim() })
            }}
          >
            <label htmlFor="onboard-invite-code" className="sr-only">Invite code</label>
            <input
              ref={ref}
              id="onboard-invite-code"
              name="onboard-invite-code"
              value={code}
              onChange={(e) => { setCode(e.target.value); setEmptyWarning(false) }}
              placeholder="Invite code"
              disabled={isSubmitting}
              autoFocus
              enterKeyHint="go"
              // iOS capitalises and autocorrects by default, which silently mangles a code
              // into one the host will reject — a real failure with no visible cause.
              autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              aria-invalid={shown ? true : undefined}
              aria-describedby={shown ? 'onboard-gate-error' : undefined}
              // text-base is load-bearing, not a size preference: Safari zooms the whole
              // viewport when focusing any field under 16px, which shifts the panel
              // sideways mid-typing.
              className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-base
                         focus:border-transparent focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-1 rounded-lg bg-neutral-900
                         px-4 py-3 text-base font-medium text-white
                         hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? 'Checking…' : 'Continue'}
              {!isSubmitting && <HiOutlineArrowRight className="h-4 w-4" />}
            </button>
          </form>
        )}

        {price !== null && (
          <>
            {takesCode && (
              <div className="my-3 flex items-center gap-2 text-xs text-neutral-500">
                <span className="h-px flex-1 bg-neutral-200" />or<span className="h-px flex-1 bg-neutral-200" />
              </div>
            )}
            <button
              onClick={() => !isSubmitting && onSubmit({ payment: price })}
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border
                         border-neutral-300 px-4 py-3 text-base
                         hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <HiOutlineCreditCard className="h-4 w-4 text-neutral-400" />
              Pay ${price.toFixed(2)} to start
            </button>
          </>
        )}

        {/* role="alert" because nothing else announces the refusal — the panel does not
            move, so a screen reader would otherwise get silence. Icon as well as colour:
            red text alone is the whole signal, which fails for anyone who cannot see it. */}
        {shown && (
          <p id="onboard-gate-error" role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-600">
            <HiOutlineExclamationCircle className="mt-px h-4 w-4 shrink-0" />
            {shown}
          </p>
        )}

        {/* neutral-400 on white is about 2.5:1 — below WCAG 1.4.3, and this is the one
            line that helps a reader who has no code and nothing else to try. */}
        <p className="mt-5 text-xs text-neutral-500">
          No code? Ask whoever shared this agent with you.
        </p>
      </div>
    </div>
  )
})
