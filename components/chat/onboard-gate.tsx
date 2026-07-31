/**
 * @purpose Say up front that an agent is gated, in place of a composer the reader
 *   is not yet allowed to use.
 * @llm-note The old order was: composer → reader types → connect → agent refuses →
 *   an onboard card appears in the transcript → the message they wrote is gone
 *   (#27). Every part of that is avoidable, because `/info` has said
 *   `onboard: {invite_code: true}` the whole time — the client just could not see
 *   it until AgentInfo started carrying the field (connectonion-ts v0.2.0).
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

import { useState } from 'react'
import { HiOutlineTicket, HiOutlineArrowRight, HiOutlineCreditCard } from 'react-icons/hi'
import type { AgentOnboard } from 'connectonion/react'

interface OnboardGateProps {
  onboard: AgentOnboard
  agentName: string
  onSubmit: (options: { inviteCode?: string; payment?: number }) => void
  isSubmitting?: boolean
  error?: string | null
}

export function OnboardGate({
  onboard, agentName, onSubmit, isSubmitting = false, error = null,
}: OnboardGateProps) {
  const [code, setCode] = useState('')
  const takesCode = onboard.invite_code === true
  const price = typeof onboard.payment === 'number' ? onboard.payment : null

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <HiOutlineTicket className="w-4 h-4 text-neutral-400" />
        <p className="text-sm font-medium text-neutral-800">
          {agentName} is invite-only
        </p>
      </div>
      <p className="text-xs text-neutral-500 mb-3">
        Enter a code to start talking. Nothing you write is sent until you are in.
      </p>

      {takesCode && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (code.trim() && !isSubmitting) onSubmit({ inviteCode: code.trim() })
          }}
        >
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
            autoFocus
            disabled={isSubmitting}
            className="flex-1 px-3 py-2 rounded-lg border border-neutral-200 text-sm
                       focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          />
          <button
            type="submit"
            disabled={!code.trim() || isSubmitting}
            className="px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-medium
                       disabled:bg-neutral-300 flex items-center gap-1"
          >
            {isSubmitting ? 'Checking…' : 'Continue'}
            {!isSubmitting && <HiOutlineArrowRight className="w-3.5 h-3.5" />}
          </button>
        </form>
      )}

      {price !== null && (
        <button
          onClick={() => !isSubmitting && onSubmit({ payment: price })}
          disabled={isSubmitting}
          className="mt-2 w-full px-4 py-2 rounded-lg border border-neutral-200 text-sm
                     flex items-center justify-center gap-1.5 hover:bg-neutral-50"
        >
          <HiOutlineCreditCard className="w-4 h-4 text-neutral-400" />
          Pay ${price.toFixed(2)} to start
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
