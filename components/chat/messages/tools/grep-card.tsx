'use client'

import React, { useState } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { HiOutlineChevronRight, HiOutlineChevronDown } from 'react-icons/hi'
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

function getPreviewLines(result: string, maxLines = 5): { lines: string[]; remaining: number } {
  const allLines = result.split('\n').filter(l => l.trim())
  const lines = allLines.slice(0, maxLines)
  const remaining = allLines.length - maxLines
  return { lines, remaining: Math.max(0, remaining) }
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
  const { lines: previewLines, remaining } = hasOutput
    ? getPreviewLines(result)
    : { lines: [], remaining: 0 }

  // Format header: grep(path, pattern)
  const headerArgs = [path, pattern].filter(Boolean).join(', ')

  return (
    <div className="py-1.5">
      {/* Header */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Expand icon */}
        {isExpanded ? (
          <HiOutlineChevronDown className="w-3.5 h-3.5 text-neutral-400" />
        ) : (
          <HiOutlineChevronRight className="w-3.5 h-3.5 text-neutral-400" />
        )}

        {/* Status */}
        {status === 'done' && <span className="text-green-600">✓</span>}
        {status === 'error' && <span className="text-red-500">✗</span>}
        {status === 'running' && needsApproval && (approvalSent === 'skipped' || approvalSent === 'stopped') && <span className="text-red-500">✗</span>}
        {status === 'running' && needsApproval && approvalSent && approvalSent !== 'skipped' && approvalSent !== 'stopped' && <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
        {status === 'running' && needsApproval && !approvalSent && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
        {status === 'running' && !needsApproval && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}

        {/* Tool name with args */}
        <span className="text-sm font-mono">
          <span className="font-medium text-neutral-700">{name}</span>
          {headerArgs && <span className="text-neutral-500">({headerArgs})</span>}
        </span>

        {/* Status text */}
        {status === 'done' || status === 'error' ? (
          <>
            {timing_ms && <span className="text-neutral-400 text-xs">{formatTime(timing_ms)}</span>}
            {fileCount > 0 && !isExpanded && <span className="text-neutral-400 text-xs">{fileCount} files</span>}
          </>
        ) : needsApproval && approvalSent ? (
          approvalSent === 'skipped' ? (
            <span className="text-amber-500 text-xs font-medium">skipped</span>
          ) : approvalSent === 'stopped' ? (
            <span className="text-red-500 text-xs font-medium">stopped</span>
          ) : (
            <span className="text-green-600 text-xs font-medium">approved — running...</span>
          )
        ) : needsApproval ? (
          <span className="text-amber-600 text-xs font-medium">awaiting approval</span>
        ) : (
          <span className="text-neutral-400 text-xs">running...</span>
        )}
      </div>

      {/* Terminal block - Monokai background */}
      {hasOutput && (
        <div className="mt-2 ml-5 bg-[#272822] rounded-lg overflow-hidden">
          <div
            className="cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <div className="p-3 text-xs font-mono max-h-80 overflow-y-auto">
              {/* File list with left border */}
              <div className="border-l-2 border-[#3E3D32] pl-3 space-y-0.5">
                {(isExpanded ? allLines : previewLines).map((line, i) => (
                  <div key={i} className="leading-5 truncate hover:bg-[#3E3D32]/50 -ml-3 pl-3 -mr-3 pr-3">
                    {highlightPath(line)}
                  </div>
                ))}
                {!isExpanded && remaining > 0 && (
                  <div className="text-[#75715E] pt-1">+{remaining} more files</div>
                )}
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
