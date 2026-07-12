'use client'

import { HiOutlineClipboardList, HiOutlineLightBulb } from 'react-icons/hi'

interface EnterPlanModeCardProps {
  toolCall: {
    name: string
    status: 'running' | 'done' | 'error'
    result?: string
    timing_ms?: number
  }
}

export function EnterPlanModeCard({ toolCall }: EnterPlanModeCardProps) {
  const { status, timing_ms } = toolCall

  const statusColor = status === 'done' ? 'text-neutral-700' : status === 'error' ? 'text-red-600' : 'text-neutral-500'
  const statusIcon = status === 'done' ? '✓' : status === 'error' ? '✗' : '●'

  return (
    <div className="py-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <span className={statusColor}>{statusIcon}</span>
        <HiOutlineClipboardList className="w-4 h-4 text-neutral-500" />
        <span className="font-medium">Entered Plan Mode</span>
        {timing_ms !== undefined && (
          <span className="text-neutral-500 text-xs">{(timing_ms / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* Info Card */}
      <div className="ml-5 mt-2">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <HiOutlineLightBulb className="w-5 h-5 text-neutral-600" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-neutral-900">
                Planning the implementation
              </p>
              <p className="text-sm text-neutral-600 leading-relaxed">
                I'm designing a detailed implementation plan with step-by-step guidance.
                Once ready, I'll share it for your review and approval before proceeding.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
