'use client'

import type { OnboardSuccessUI } from '../types'
import { HiOutlineCheckCircle } from 'react-icons/hi'

export function OnboardSuccess({ data }: { data: OnboardSuccessUI }) {
  return (
    <div className="flex justify-start py-2">
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100">
          <HiOutlineCheckCircle className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <div className="text-sm font-medium text-emerald-900">
            Verified — Continuing your request
          </div>
          <div className="text-sm text-emerald-700">
            {data.message}
          </div>
        </div>
      </div>
    </div>
  )
}
