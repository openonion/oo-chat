'use client'

import React, { useState, useEffect } from 'react'
import type { ToolCallUI, PendingApproval } from '../../types'
import { 
  HiOutlineChevronRight, 
  HiOutlineChevronDown, 
  HiOutlineTerminal,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineClipboardCopy
} from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

interface BashCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

// Monokai-style bash syntax highlighting
function highlightBash(command: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = []
  let remaining = command
  let key = 0

  const colors = {
    string: 'text-[#E6DB74]',      // Yellow
    operator: 'text-[#F92672]',    // Pink/Magenta
    flag: 'text-[#66D9EF]',        // Cyan
    variable: 'text-[#FD971F]',    // Orange
    number: 'text-[#AE81FF]',      // Purple
    command: 'text-[#A6E22E]',     // Green
    argument: 'text-[#F8F8F2]',    // White
  }

  const patterns: { regex: RegExp; className: string }[] = [
    { regex: /^"[^"]*"/, className: colors.string },
    { regex: /^'[^']*'/, className: colors.string },
    { regex: /^(\|{1,2}|&&|>>|>|<|;|2>)/, className: colors.operator },
    { regex: /^--?[\w-]+/, className: colors.flag },
    { regex: /^\$[\w{}]+/, className: colors.variable },
    { regex: /^\d+/, className: colors.number },
  ]

  while (remaining.length > 0) {
    let matched = false
    for (const { regex, className } of patterns) {
      const match = remaining.match(regex)
      if (match) {
        tokens.push(<span key={key++} className={className}>{match[0]}</span>)
        remaining = remaining.slice(match[0].length)
        matched = true
        break
      }
    }

    if (!matched) {
      const wsMatch = remaining.match(/^\s+/)
      if (wsMatch) {
        tokens.push(<span key={key++}>{wsMatch[0]}</span>)
        remaining = remaining.slice(wsMatch[0].length)
      } else {
        const wordMatch = remaining.match(/^[\w./~@:%-]+/)
        if (wordMatch) {
          const isCommand = tokens.length === 0 || 
            (tokens.length > 0 && typeof tokens[tokens.length-1] === 'object' && 
             (tokens[tokens.length-1] as any)?.props?.className === colors.operator)
          tokens.push(<span key={key++} className={isCommand ? colors.command : colors.argument}>{wordMatch[0]}</span>)
          remaining = remaining.slice(wordMatch[0].length)
        } else {
          tokens.push(<span key={key++} className={colors.argument}>{remaining[0]}</span>)
          remaining = remaining.slice(1)
        }
      }
    }
  }
  return tokens
}

function getPreviewLines(result: string, maxLines = 3): { lines: string[]; remaining: number } {
  const allLines = result.split('\n').filter(l => l.trim())
  const lines = allLines.slice(0, maxLines)
  const remaining = allLines.length - maxLines
  return { lines, remaining: Math.max(0, remaining) }
}

// Check if this is a "tool blocked" error (from prefer_write_tool plugin)
function isBlockedError(result: string): boolean {
  return result.includes('Bash file creation blocked')
}

export function BashCard({ toolCall, pendingApproval, onApprovalResponse }: BashCardProps) {
  const { args, status, result, timing_ms } = toolCall
  const [isExpanded, setIsExpanded] = useState(false)
  const [approvalSent, setApprovalSent] = useState<'approved' | 'approved_session' | 'skipped' | 'stopped' | null>(null)
  const [runningSeconds, setRunningSeconds] = useState(0)
  const [copied, setCopied] = useState(false)

  const command = args?.command as string | undefined
  const commandName = command?.split(/\s+/)[0] || 'this command'

  // Hide bash card when tool was blocked - tool_blocked card shows instead
  if (status === 'error' && result && isBlockedError(result)) {
    return null
  }

  useEffect(() => {
    const isActuallyRunning = status === 'running' && (!pendingApproval || approvalSent)
    if (!isActuallyRunning) {
      setRunningSeconds(0)
      return
    }
    const interval = setInterval(() => setRunningSeconds(s => s + 1), 1000)
    return () => clearInterval(interval)
  }, [status, pendingApproval, approvalSent])

  const hasOutput = result && result.length > 0
  const { lines: previewLines, remaining } = hasOutput
    ? getPreviewLines(result)
    : { lines: [], remaining: 0 }

  const needsApproval = !!pendingApproval && !!onApprovalResponse

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => {
    if (approvalSent) return
    if (approved) setApprovalSent(scope === 'session' ? 'approved_session' : 'approved')
    else setApprovalSent(mode === 'reject_soft' ? 'skipped' : 'stopped')
    onApprovalResponse?.(approved, scope, mode)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!command) return
    navigator.clipboard.writeText(command)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="py-2.5">
      {/* Header */}
      <div
        className="flex items-center gap-2 cursor-pointer group mb-2"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-1.5 flex-1">
          {isExpanded ? (
            <HiOutlineChevronDown className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          ) : (
            <HiOutlineChevronRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-600 transition-colors" />
          )}

          {status === 'done' ? (
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100/50">
              <HiOutlineCheck className="w-2.5 h-2.5 text-green-600" />
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center justify-center w-4 h-4 rounded-full bg-red-100/50">
              <HiOutlineX className="w-2.5 h-2.5 text-red-600" />
            </div>
          ) : status === 'running' ? (
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse ml-1",
              needsApproval && !approvalSent ? "bg-neutral-500" : "bg-neutral-900"
            )} />
          ) : (
            <div className="w-2 h-2 rounded-full bg-neutral-300 ml-1" />
          )}

          <HiOutlineTerminal className="w-4 h-4 text-neutral-500 ml-0.5" />
          <span className="text-sm font-bold text-neutral-700 tracking-tight">Bash</span>
        </div>

        <div className="flex items-center gap-2">
          {status === 'done' || status === 'error' ? (
            <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest">
              {status === 'done' ? 'Exit Code 0' : 'Exit Code 1'} {timing_ms && `(${formatTime(timing_ms)})`}
            </span>
          ) : needsApproval && approvalSent ? (
            <span className={cn(
              "text-[10px] uppercase font-bold tracking-widest",
              approvalSent === 'skipped' ? "text-neutral-400" : "text-red-500"
            )}>
              {approvalSent === 'skipped' ? 'Skipped' : 'Stopped'}
            </span>
          ) : needsApproval ? (
            <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest animate-pulse">Waiting for Permission</span>
          ) : (
            <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest tabular-nums animate-pulse">
              Running{runningSeconds > 0 && ` ${formatSeconds(runningSeconds)}`}
            </span>
          )}
        </div>
      </div>

      {/* Terminal Block */}
      <div className="ml-5">
        <div className="bg-[#1e1e1e] rounded-lg overflow-hidden relative group/terminal">
          <div
            className="cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <pre className="px-3 py-2.5 text-[13px] text-[#F8F8F2] font-mono whitespace-pre-wrap overflow-x-auto max-h-96 overflow-y-auto leading-relaxed scrollbar-thin scrollbar-thumb-neutral-700">
                <div className="flex items-start gap-2">
                  <span className="text-[#75715E] select-none">$</span>
                  <div className="flex-1">{highlightBash(command || '')}</div>
                </div>
                {hasOutput && (
                  <div className="text-neutral-300 border-t border-[#333] pt-2.5 mt-2.5 opacity-90 text-[12px]">
                    {result}
                  </div>
                )}
                {!hasOutput && status === 'done' && (
                  <div className="text-[#75715E] mt-2.5 italic text-[11px] font-mono opacity-50">// No output</div>
                )}
              </pre>
            ) : (
              <pre className="px-3 py-2.5 text-[13px] font-mono leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-[#75715E] select-none">$</span>
                  <div className="flex-1 truncate">{highlightBash(command || '')}</div>
                </div>
                {hasOutput && (
                  <div className="mt-2.5 text-neutral-400 border-t border-[#333] pt-2.5 overflow-hidden text-[12px]">
                    {previewLines.slice(0, 2).map((line, i) => (
                      <div key={i} className="truncate opacity-70 mb-0.5">{line}</div>
                    ))}
                    {remaining > 0 && (
                      <div className="text-[#75715E] mt-1.5 text-[10px] opacity-60">
                        +{remaining + (previewLines.length > 2 ? previewLines.length - 2 : 0)} more lines
                      </div>
                    )}
                  </div>
                )}
              </pre>
            )}
          </div>
          {/* Copy button - appears on hover */}
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 text-neutral-600 hover:text-neutral-300 transition-all p-1 rounded opacity-0 group-hover/terminal:opacity-100"
            title="Copy command"
          >
            {copied ? <HiOutlineCheck className="w-3.5 h-3.5 text-green-500" /> : <HiOutlineClipboardCopy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Approval Buttons */}
      {needsApproval && status === 'running' && (
        <div className="mt-4 ml-5 animate-in fade-in slide-in-from-top-2 duration-400">
          <ApprovalButtons approvalSent={approvalSent} onApproval={handleApproval} toolName={commandName} description={pendingApproval?.description} batchRemaining={pendingApproval?.batch_remaining} />
        </div>
      )}
    </div>
  )
}
