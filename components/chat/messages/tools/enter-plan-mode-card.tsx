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

  const statusColor = status === 'done' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-blue-500'
  const statusIcon = status === 'done' ? '✓' : status === 'error' ? '✗' : '●'

  return (
    <div className="py-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <span className={statusColor}>{statusIcon}</span>
        <HiOutlineClipboardList className="w-4 h-4 text-blue-500" />
        <span className="font-medium">Entered Plan Mode</span>
        {timing_ms !== undefined && (
          <span className="text-neutral-400 text-xs">{(timing_ms / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* Info Card */}
      <div className="ml-5 mt-2">
        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4">
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <HiOutlineLightBulb className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Planning the implementation
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
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
