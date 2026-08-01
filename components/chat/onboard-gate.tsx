/**
 * @purpose Say up front that an agent is gated, in place of a composer the reader
 *   is not yet allowed to use.
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
 *   Deliberately *not* a wall in front of the landing page. Name, model, skills and
 *   example prompts are what convince someone to go and ask for a code; hiding them
 *   behind the code is asking for the ticket before showing the film. What changes
 *   is only the composer: an input the reader may use, instead of one that will
 *   reject them.
 *
 *   The in-transcript OnboardRequired card stays as-is. It is still correct for the
 *   case this cannot cover — an agent that starts open and gates mid-session, where
 *   there is no landing page left to render.
 */
'use client'

import { forwardRef, useState } from 'react'
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

  return (
    <section
      aria-labelledby="onboard-gate-title"
      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-2 mb-1">
        <HiOutlineTicket className="w-4 h-4 text-neutral-400" />
        {/* Matches the hero's rule: a real name gets the display serif, a raw
            address is data and stays mono. */}
        <h2 id="onboard-gate-title" className={`text-sm font-medium text-neutral-800 ${/^0x/.test(agentName) ? 'font-mono' : ''}`}>
          {agentName} is invite-only
        </h2>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Enter your code to start talking.
      </p>

      {takesCode && (
        <form
          className="flex gap-2"
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
            // iOS capitalises and autocorrects by default, which silently mangles a code
            // into one the host will reject — a real failure with no visible cause.
            autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false}
            aria-invalid={shown ? true : undefined}
            aria-describedby={shown ? 'onboard-gate-error' : undefined}
            className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 text-sm
                       focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium
                       hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center gap-1"
          >
            {isSubmitting ? 'Checking…' : 'Continue'}
            {!isSubmitting && <HiOutlineArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>
      )}

      {price !== null && (
        <>
          {takesCode && (
            <div className="my-2.5 flex items-center gap-2 text-[11px] text-neutral-400">
              <span className="h-px flex-1 bg-neutral-200" />or<span className="h-px flex-1 bg-neutral-200" />
            </div>
          )}
          <button
            onClick={() => !isSubmitting && onSubmit({ payment: price })}
            disabled={isSubmitting}
            className="w-full px-4 py-2 rounded-lg border border-neutral-200 text-sm
                       flex items-center justify-center gap-1.5 hover:bg-neutral-50
                       disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <HiOutlineCreditCard className="w-4 h-4 text-neutral-400" />
            Pay ${price.toFixed(2)} to start
          </button>
        </>
      )}

      {/* role="alert" because nothing else announces the refusal — the card does not
          move, so a screen reader would otherwise get silence. Icon as well as colour:
          red text alone is the whole signal, which fails for anyone who cannot see it. */}
      {shown && (
        <p id="onboard-gate-error" role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
          <HiOutlineExclamationCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          {shown}
        </p>
      )}

      <p className="mt-3 text-[11px] text-neutral-400">
        No code? Ask whoever shared this agent with you.
      </p>
    </section>
  )
})
