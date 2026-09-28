'use client'

import type { OnboardSuccessUI } from '../types'
import { HiOutlineCheckCircle } from 'react-icons/hi'

export function OnboardSuccess({ data }: { data: OnboardSuccessUI }) {
  return (
    <p role="status" className="flex items-start gap-2 py-2 text-sm text-neutral-500">
      <HiOutlineCheckCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
      <span>{data.message || 'Invite accepted.'}</span>
    </p>
  )
}
