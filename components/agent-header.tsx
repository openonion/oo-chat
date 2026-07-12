'use client'

import { HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi'
import { shortAddress, agentInitial, type AgentInfo } from '@/hooks/use-agent-info'

interface AgentHeaderProps {
  address: string
  info?: AgentInfo
  variant?: 'compact' | 'full'
}

export function AgentHeader({ address, info, variant = 'full' }: AgentHeaderProps) {
  const label = info?.name || shortAddress(address)
  const isOnline = info?.online

  if (variant === 'compact') {
    // Rendered in the sidebar — minimal light, live pulse for online.
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className="w-6 h-6 rounded-md bg-neutral-900 flex items-center justify-center shrink-0">
          <span className="text-white font-semibold text-xs">
            {agentInitial(label, address)}
          </span>
        </div>
        <span className={`font-medium text-sm text-neutral-700 truncate ${label === shortAddress(address) ? 'font-mono' : ''}`} title={shortAddress(address)}>{label}</span>
        {isOnline !== undefined && (
          isOnline
            ? <span className="relative flex h-1.5 w-1.5 shrink-0" title="online">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
              </span>
            : <span className="h-1.5 w-1.5 rounded-full bg-neutral-300 shrink-0" title="offline" />
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center">
        <span className="text-white font-bold">
          {agentInitial(label, address)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className={`font-bold text-neutral-900 truncate ${label === shortAddress(address) ? 'font-mono' : ''}`}>{label}</h1>
          {isOnline !== undefined && (
            isOnline
              ? <HiOutlineStatusOnline className="w-4 h-4 text-green-500 shrink-0" />
              : <HiOutlineStatusOffline className="w-4 h-4 text-neutral-400 shrink-0" />
          )}
        </div>
        {label !== shortAddress(address) && (
          <p className="text-xs text-neutral-500 font-mono">{shortAddress(address)}</p>
        )}
      </div>
    </div>
  )
}
