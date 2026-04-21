'use client'

import { HiOutlineStop } from 'react-icons/hi'

interface PipelineControlProps {
  executionState: 'running' | 'paused' | 'stopped' | null
  isProcessing: boolean
  stopExecution: () => void
}

export function PipelineControl({ executionState, isProcessing, stopExecution }: PipelineControlProps) {
  // Only show when agent is actively working
  if (!isProcessing) return null

  const isStopped = (executionState ?? 'running') === 'stopped'

  return (
    <div className="flex items-center gap-2 py-1">
      <div className="flex-1" />

      {isStopped ? (
        <span className="text-[11px] font-medium text-red-400">Stopped</span>
      ) : (
        <button
          onClick={stopExecution}
          className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
          title="Stop agent"
        >
          <HiOutlineStop className="w-3 h-3" />
          Stop
        </button>
      )}
    </div>
  )
}
