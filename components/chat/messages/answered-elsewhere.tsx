'use client'

import { HiOutlineDeviceMobile } from 'react-icons/hi'

/**
 * A prompt this device tried to answer after another device showing the same
 * session already had. The Host refused the late answer (STALE_ANSWER,
 * connectonion#1692) and applied nothing, so this says only what is known: it
 * was answered elsewhere. It does not claim which way, because this device was
 * never told, and it offers no action, because the request it would act on is
 * over and a re-send could only land on a request nobody here has seen.
 */
export function AnsweredElsewhere({ kind }: { kind: 'approval' | 'question' }) {
  return (
    <div
      role="status"
      data-answered-elsewhere=""
      className="py-2 flex items-center gap-2 text-sm text-neutral-500"
    >
      <HiOutlineDeviceMobile className="w-4 h-4 shrink-0" aria-hidden="true" />
      <span>
        {kind === 'approval' ? 'Approval answered on another device' : 'Question answered on another device'}
      </span>
    </div>
  )
}
