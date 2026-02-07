'use client'

import React, { useState } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { 
  HiOutlineChevronRight, 
  HiOutlineChevronDown, 
  HiOutlineCloud,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineTerminal,
  HiOutlineClock
} from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface BackgroundCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

export function BackgroundCard({ toolCall, pendingApproval, onApprovalResponse }: BackgroundCardProps) {
  const { args, status, result, timing_ms } = toolCall
  const [isExpanded, setIsExpanded] = useState(false)
  const [approvalSent, setApprovalSent] = useState<'approved' | 'approved_session' | 'skipped' | 'stopped' | null>(null)
  
  const description = args?.description as string || 'Background Task'
  const prompt = args?.prompt as string
  const subagent = args?.subagent_type as string
  const taskId = args?.task_id as string

  const needsApproval = !!pendingApproval && !!onApprovalResponse

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => {
    if (approvalSent) return
    if (approved) setApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
    else setApprovalSent(mode === 'reject_soft' ? 'skipped' : 'stopped')
    onApprovalResponse?.(approved, scope, mode)
  }

  return (
    <div className="py-2.5">
      <div
        className="flex items-center gap-3 cursor-pointer group mb-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 flex-1">
          {isExpanded ? (
            <HiOutlineChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          ) : (
            <HiOutlineChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          )}

          <div className="relative flex items-center justify-center w-6 h-6">
            {status === 'running' && (
              <>
                <span className="absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-20 animate-ping" />
                <span className="absolute inline-flex h-4 w-4 rounded-full bg-sky-500 opacity-10 animate-pulse" />
              </>
            )}
            
            {status === 'done' ? (
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100/50">
                <HiOutlineCheck className="w-3 h-3 text-green-600" />
              </div>
            ) : status === 'error' ? (
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100/50">
                <HiOutlineX className="w-3 h-3 text-red-600" />
              </div>
            ) : (
              <HiOutlineCloud className={cn(
                "w-4 h-4 relative z-10",
                status === 'running' ? "text-sky-600" : "text-neutral-500"
              )} />
            )}
          </div>

          <div className="flex flex-col">
            <span className="text-sm font-bold text-neutral-800 tracking-tight leading-none">
              {description}
            </span>
            <span className="text-[10px] text-neutral-400 font-medium uppercase tracking-wider mt-0.5">
              {subagent ? `${subagent} Agent` : 'Background Process'}
              {taskId && <span className="ml-1 font-mono opacity-70">#{taskId.slice(0, 6)}</span>}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === 'done' || status === 'error' ? (
            <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
              {timing_ms && <HiOutlineClock className="w-3 h-3" />}
              {timing_ms ? formatTime(timing_ms) : (status === 'done' ? 'Completed' : 'Failed')}
            </span>
          ) : needsApproval && approvalSent ? (
            <span className={cn(
              "text-[10px] uppercase font-bold tracking-widest",
              approvalSent === 'skipped' ? "text-amber-500" : "text-red-500"
            )}>
              {approvalSent === 'skipped' ? 'Skipped' : 'Stopped'}
            </span>
          ) : needsApproval ? (
            <span className="text-amber-600 text-[10px] uppercase font-bold tracking-widest animate-pulse">
              Approval Needed
            </span>
          ) : (
            <span className="text-sky-600 text-[10px] uppercase font-bold tracking-widest animate-pulse">
              Processing...
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="ml-9 animate-in fade-in slide-in-from-top-1 duration-200">
          {prompt && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <HiOutlineTerminal className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-xs font-medium text-neutral-500">Task Instructions</span>
              </div>
              <div className="bg-neutral-50 rounded-md border border-neutral-200 p-3">
                <pre className="text-xs text-neutral-600 whitespace-pre-wrap font-mono leading-relaxed">
                  {prompt}
                </pre>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <HiOutlineCheck className="w-3.5 h-3.5 text-green-500" />
                <span className="text-xs font-medium text-neutral-500">Result</span>
              </div>
              <div className="bg-[#1e1e1e] rounded-lg overflow-hidden">
                <pre className="px-3 py-2.5 text-[13px] text-[#F8F8F2] font-mono whitespace-pre-wrap overflow-x-auto max-h-80 overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-neutral-700">
                  {result}
                </pre>
              </div>
            </div>
          )}

          {needsApproval && status === 'running' && (
            <div className="mt-3">
              <ApprovalButtons
                approvalSent={approvalSent}
                onApproval={handleApproval}
                toolName={subagent || 'background task'}
                description={pendingApproval?.description}
                batchRemaining={pendingApproval?.batch_remaining}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
