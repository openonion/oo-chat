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
import { HiOutlineTicket, HiOutlineArrowRight, HiOutlineCheck, HiOutlineExclamationCircle } from 'react-icons/hi'
import { AgentAddress } from '@/components/agent-address'
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
  // The host publishes where to send it (get_onboard_requirements fills this from
  // its own address). Without it there is nothing a reader could act on, so the
  // branch says so rather than offering a button that cannot be completed.
  const payTo = onboard.paymentAddress
  const shown = error ?? (emptyWarning ? 'Enter your invite code.' : null)
  const [payOpen, setPayOpen] = useState(false)

  const panelRef = useRef<HTMLDivElement>(null)

  // Hold Tab inside the panel. There is nothing behind this worth reaching — every
  // control back there is one the agent would refuse — and a keyboard user who tabs
  // out of a wall lands in a page they cannot see and cannot use.
  //
  // No Escape handler on purpose: dismissing leaves nothing usable, so a key that
  // looks like it should close this would either lie or do nothing visible. The
  // way past it is a code or the payment line; there is no other.
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
    // Opaque, not a dim scrim, and the whole page: nothing behind it is usable,
    // so nothing behind it is shown. items-center-safe, not items-center: once the
    // panel is taller than this box (an iPhone SE with the keyboard open is about
    // 360px), plain centring pushes its top to a negative offset no scroll
    // position can reach.
    <div
      className="fixed inset-0 z-50 flex items-center-safe justify-center overflow-y-auto
                 bg-neutral-50 px-6 py-8"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboard-gate-title"
        className="grid w-full max-w-sm gap-3 rounded-2xl border border-neutral-200 bg-white p-6 shadow-lg"
      >
        <h2
          id="onboard-gate-title"
          className="flex items-center gap-2.5 text-base font-semibold text-neutral-900"
        >
          <HiOutlineTicket aria-hidden="true" className="h-4 w-4 shrink-0 text-neutral-400" />
          {/* A raw address is data and stays mono. */}
          <span className={`min-w-0 break-words ${/^0x/.test(agentName) ? 'font-mono text-sm' : ''}`}>
            {agentName} is invite-only
          </span>
        </h2>

        {takesCode && (
          <form
            className="grid gap-3"
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
              className="h-[50px] w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900
                         outline-none placeholder:text-neutral-400 focus:border-primary focus:ring-[3px] focus:ring-tint"
            />
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-primary
                         text-[15px] font-semibold text-on-primary transition-colors
                         hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Checking…' : 'Continue'}
              {!isSubmitting && <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" />}
            </button>
          </form>
        )}

        {/* role="alert" because nothing else announces the refusal — the panel does not
            move, so a screen reader would otherwise get silence. Icon as well as colour. */}
        {shown && (
          <p id="onboard-gate-error" role="alert" className="flex items-start gap-1.5 text-sm text-red-700">
            <HiOutlineExclamationCircle aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
            {shown}
          </p>
        )}

        {/* Paying is the alternative, so it is one quiet line that opens the
            existing flow in place rather than a second panel competing with the
            code field. With no code option it is the flow, so it starts open. */}
        {price !== null && takesCode && !payOpen && (
          <p className="pt-1 text-center text-[13px] text-neutral-600">
            or{' '}
            <button
              type="button"
              onClick={() => setPayOpen(true)}
              aria-expanded={false}
              aria-controls="onboard-gate-payment"
              className="text-primary underline underline-offset-[3px] hover:text-primary-hover"
            >
              pay ${price.toFixed(2)} to join
            </button>
          </p>
        )}

        {price !== null && (payOpen || !takesCode) && (
          // This never charged anything. onSubmit({payment}) signs an assertion that a
          // payment was made and the agent decides whether to believe it, so the payee
          // address the host publishes is shown, and the button says what it asserts.
          <div id="onboard-gate-payment" className="grid gap-3 border-t border-neutral-200 pt-3">
            {payTo ? (
              <>
                <p className="text-sm text-neutral-700">
                  Send <span className="font-semibold">${price.toFixed(2)}</span> to this address, then
                  confirm. {agentName} checks before letting you in.
                </p>
                <div>
                  <AgentAddress address={payTo} />
                </div>
                <button
                  onClick={() => !isSubmitting && onSubmit({ payment: price })}
                  disabled={isSubmitting}
                  className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border
                             border-neutral-300 text-sm text-neutral-900
                             hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <HiOutlineCheck aria-hidden="true" className="h-4 w-4 text-neutral-500" />
                  I&apos;ve sent it
                </button>
              </>
            ) : (
              <p className="text-sm text-neutral-600">
                {agentName} asks for ${price.toFixed(2)} but has not published an address to
                send it to.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
})
