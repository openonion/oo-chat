'use client'

import { HiOutlineRocketLaunch } from 'react-icons/hi2'

export function FullAccessModeBanner({ turnsRemaining, onExit }: { turnsRemaining?: number | null; onExit?: () => void }) {
  return (
    <div className="flex items-center justify-between bg-neutral-900 px-4 py-2">
      <div className="flex items-center gap-2">
        <HiOutlineRocketLaunch className="h-4 w-4 text-red-400" />
        <span className="text-sm font-medium text-white">Full access</span>
        {turnsRemaining != null && <span className="text-xs text-neutral-300">{turnsRemaining} turns remaining</span>}
      </div>
      {onExit && <button onClick={onExit} className="rounded border border-neutral-600 px-3 py-1 text-xs font-medium text-white hover:bg-neutral-800">Exit Full access</button>}
    </div>
  )
}
