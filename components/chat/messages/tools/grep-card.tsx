'use client'

import React, { useState } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { HiOutlineChevronRight, HiOutlineChevronDown } from 'react-icons/hi'
import { ToolStatus } from './tool-status'
import { ApprovalButtons } from './approval-buttons'

interface GrepCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

// Get file extension color based on type (Monokai palette)
function getExtensionColor(ext: string): string {
  const colorMap: Record<string, string> = {
    // Python - cyan
    'py': '#66D9EF',
    // JavaScript/TypeScript - yellow/cyan
    'js': '#E6DB74',
    'jsx': '#E6DB74',
    'ts': '#66D9EF',
    'tsx': '#66D9EF',
    // Markdown/Text - white
    'md': '#F8F8F2',
    'txt': '#F8F8F2',
    // Config - orange
    'json': '#FD971F',
    'yaml': '#FD971F',
    'yml': '#FD971F',
    'toml': '#FD971F',
    // Shell - green
    'sh': '#A6E22E',
    'bash': '#A6E22E',
    // Web - pink
    'html': '#F92672',
    'css': '#F92672',
    // Go/Rust - purple
    'go': '#AE81FF',
    'rs': '#AE81FF',
  }
  return colorMap[ext.toLowerCase()] || '#A6E22E'
}

// Highlight file path with extension-based coloring
function highlightPath(path: string): React.ReactNode {
  const lastSlash = path.lastIndexOf('/')
  const lastDot = path.lastIndexOf('.')

  if (lastSlash === -1) {
    // No directory, just filename
    const ext = lastDot > 0 ? path.slice(lastDot + 1) : ''
    const color = getExtensionColor(ext)
    return <span style={{ color }}>{path}</span>
  }

  const dir = path.slice(0, lastSlash + 1)
  const file = path.slice(lastSlash + 1)
  const ext = lastDot > lastSlash ? path.slice(lastDot + 1) : ''
  const color = getExtensionColor(ext)

  return (
    <>
      <span className="text-[#75715E]">{dir}</span>
      <span style={{ color }}>{file}</span>
    </>
  )
}

export function GrepCard({ toolCall, pendingApproval, onApprovalResponse }: GrepCardProps) {
  const { name, args, status, result, timing_ms } = toolCall
  const [isExpanded, setIsExpanded] = useState(false)
  const [approvalSent, setApprovalSent] = useState<'approved' | 'approved_session' | 'skipped' | 'stopped' | null>(null)

  const pattern = args?.pattern as string | undefined
  const path = args?.path as string | undefined
  const needsApproval = !!pendingApproval && !!onApprovalResponse

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => {
    if (approvalSent) return
    if (approved) {
      setApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
    } else {
      setApprovalSent(mode === 'reject_soft' ? 'skipped' : 'stopped')
    }
    onApprovalResponse?.(approved, scope, mode)
  }

  const hasOutput = result && result.length > 0
  const allLines = hasOutput ? result.split('\n').filter(l => l.trim()) : []
  const fileCount = allLines.length
  // Format header: grep(path, pattern)
  const headerArgs = [path, pattern].filter(Boolean).join(', ')

  return (
    <div className="py-1.5">
      {/* Header */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Same 60px rail. grep carries a chevron and a status but no tool
            icon, so that slot stays empty instead of pulling the name left. */}
        <div className="flex w-[60px] shrink-0 items-center gap-1.5">
        {/* Expand icon */}
          {isExpanded ? (
            <HiOutlineChevronDown className="w-3.5 h-3.5 text-neutral-400" />
          ) : (
            <HiOutlineChevronRight className="w-3.5 h-3.5 text-neutral-400" />
          )}

          {/* Status */}
          <ToolStatus status={status} awaitingApproval={needsApproval && !approvalSent} />
          <span className="w-4 shrink-0" aria-hidden="true" />
        </div>

        {/* Tool name with args */}
        {/* Truncate rather than wrap: a long pattern turned the header into two
            lines while every other tool row stayed on one. */}
        <span className="min-w-0 truncate text-[13px] font-mono">
          <span className="font-medium text-neutral-800">{name}</span>
          {headerArgs && <span className="text-neutral-500">({headerArgs})</span>}
        </span>

        {/* Status text */}
        {status === 'done' || status === 'error' ? (
          // One span, not two: as separate children they wrapped onto their own
          // lines on a phone and made this row visibly taller than its neighbours.
          <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] tabular-nums text-neutral-500">
            {[timing_ms ? formatTime(timing_ms) : '', fileCount > 0 && !isExpanded ? `${fileCount} files` : '']
              .filter(Boolean)
              .join(' · ')}
          </span>
        ) : needsApproval && approvalSent ? (
          approvalSent === 'skipped' ? (
            <span className="ml-auto shrink-0 text-[11px] text-neutral-500">skipped</span>
          ) : approvalSent === 'stopped' ? (
            <span className="ml-auto shrink-0 text-[11px] font-medium text-red-600">stopped</span>
          ) : (
            <span className="text-green-600 text-xs font-medium">approved — running...</span>
          )
        ) : needsApproval ? (
          <span className="text-neutral-500 text-xs font-medium">awaiting approval</span>
        ) : (
          <span className="text-neutral-400 text-xs">running...</span>
        )}
      </div>

      {/* Terminal block — behind the chevron, like every other body. It used to
          render whenever there was output, so a row showing ▸ still displayed a
          preview and the chevron stopped meaning anything. The collapsed summary
          it was duplicating already lives in the header meta ("0.1s · 3 files"). */}
      {isExpanded && hasOutput && (
        <div className="mt-2 ml-5 bg-[#272822] rounded-lg overflow-hidden">
          <div
            className="cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-3 text-xs font-mono max-h-80 overflow-y-auto">
              {/* File list with left border */}
              <div className="border-l-2 border-[#3E3D32] pl-3 space-y-0.5">
                {allLines.map((line, i) => (
                  <div key={i} className="leading-5 truncate hover:bg-[#3E3D32]/50 -ml-3 pl-3 -mr-3 pr-3">
                    {highlightPath(line)}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Approval - separate from terminal block */}
      {needsApproval && status === 'running' && (
        <div className="mt-2 ml-5">
          <ApprovalButtons approvalSent={approvalSent} onApproval={handleApproval} toolName="Grep" description={pendingApproval?.description} batchRemaining={pendingApproval?.batch_remaining} />
        </div>
      )}

      {/* No output state */}
      {!hasOutput && status === 'done' && (
        <div className="mt-2 ml-5 bg-[#272822] rounded-lg p-3">
          <span className="text-[#75715E] text-xs font-mono">(no matches found)</span>
        </div>
      )}
    </div>
  )
}
