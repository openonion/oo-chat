'use client'

import { HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi'
import { shortAddress, type AgentInfo } from '@/hooks/use-agent-info'

interface AgentHeaderProps {
  address: string
  info?: AgentInfo
  variant?: 'compact' | 'full'
}

export function AgentHeader({ address, info, variant = 'full' }: AgentHeaderProps) {
  const label = info?.name || shortAddress(address)
  const isOnline = info?.online

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-lg bg-neutral-900 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">
            {label.charAt(0).toUpperCase()}
          </span>
        </div>
        <span className="font-medium text-sm truncate">{label}</span>
        {isOnline !== undefined && (
          isOnline
            ? <HiOutlineStatusOnline className="w-3 h-3 text-green-500 shrink-0" />
            : <HiOutlineStatusOffline className="w-3 h-3 text-neutral-400 shrink-0" />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
        <span className="text-white font-bold">
          {label.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-neutral-900 truncate">{label}</h1>
          {isOnline !== undefined && (
            isOnline
              ? <HiOutlineStatusOnline className="w-4 h-4 text-green-500 shrink-0" />
              : <HiOutlineStatusOffline className="w-4 h-4 text-neutral-400 shrink-0" />
          )}
        </div>
        <p className="text-xs text-neutral-400 font-mono">{shortAddress(address)}</p>
      </div>
    </div>
  )
}
