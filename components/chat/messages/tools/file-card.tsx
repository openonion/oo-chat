'use client'

import { useState } from 'react'
import { 
  HiOutlineCheck, 
  HiOutlineClipboard
} from 'react-icons/hi'
import type { ToolCallUI, PendingApproval } from '../../types'
import { ApprovalButtons, type ApprovalState } from './approval-buttons'
import { Modal } from '@/components/ui/modal'
import { getFileName, getFileIcon } from './file-utils'
import { CompactHeader, FileCodePeek, FileFullView } from './file-components'
import { visibleActionSummary } from './action-summary'

interface FileCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

export function FileCard({ toolCall, pendingApproval, onApprovalResponse }: FileCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [approvalSent, setApprovalSent] = useState<ApprovalState>(null)
  // This card used to have no open/closed state at all: it rendered its file
  // body unconditionally and CompactHeader had no chevron to show, so a reader
  // saw content with no control while the card beside it showed a chevron and
  // nothing. The chevron is the state now, in every card.
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const { name, args, status, result, timing_ms, summary } = toolCall
  const filePath = (args?.file_path || args?.path || args?.filename || '') as string
  const content = ((name.toLowerCase() === 'write' ? args?.content : result) as string | undefined) || ''
  
  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain') => {
    if (approvalSent) return
    setApprovalSent(approved ? 'approved' : mode === 'reject_soft' ? 'skipped' : 'stopped')
    onApprovalResponse?.(approved, scope, mode)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // No padding on this wrapper: CompactHeader owns the row's own py-1.5, and
  // stacking the two made this row 52px against its neighbours' 32px.
  return (
    <div>
      <CompactHeader 
        toolName={name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}
        fileName={getFileName(filePath)}
        actionSummary={visibleActionSummary(summary, `${name} ${getFileName(filePath)}`.trim())}
        Icon={getFileIcon(name)}
        status={status} timingMs={timing_ms} approvalSent={approvalSent}
        needsApproval={!!pendingApproval}
        isExpanded={isExpanded} onToggle={content ? () => setIsExpanded(v => !v) : undefined}
      />

      {isExpanded && content && (
      <div className="ml-[60px] relative group/card">
        <FileCodePeek content={content} filePath={filePath} onClick={() => setIsFullscreen(true)} />
        
        {content && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-100 lg:opacity-0 lg:group-hover/card:opacity-100 transition-opacity">
            <button 
              onClick={handleCopy}
              className="p-1.5 bg-neutral-900/80 hover:bg-neutral-900 text-white rounded-lg shadow-lg border border-white/10 transition-all"
              title="Copy content"
            >
              {copied ? <HiOutlineCheck className="w-3.5 h-3.5 text-brand-400" /> : <HiOutlineClipboard className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>
      )}

      <Modal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title={`${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}  ·  ${getFileName(filePath)}`}>
        <FileFullView content={content} filePath={filePath} />
      </Modal>

      {!!pendingApproval && status === 'running' && (
        <div className="mt-4 ml-[60px]">
          <ApprovalButtons 
            approvalSent={approvalSent} onApproval={handleApproval} 
            toolName={name} description={pendingApproval.description} 
            batchRemaining={pendingApproval.batch_remaining}
          />
        </div>
      )}
    </div>
  )
}
