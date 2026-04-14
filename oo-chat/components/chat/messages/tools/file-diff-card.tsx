'use client'

import { useState } from 'react'
import { 
  HiOutlinePencil, 
  HiOutlineCheck, 
  HiOutlineClipboard
} from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { Modal } from '@/components/ui/modal'
import { getFileName } from './file-utils'
import { CompactHeader, FileCodePeek, FileFullView, FileDiffSideBySideView } from './file-components'

export function FileDiffCard({ toolCall, pendingApproval, onApprovalResponse }: any) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [approvalSent, setApprovalSent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { name, args, status, timing_ms } = toolCall
  const filePath = (args?.file_path || args?.path || args?.filename || '') as string
  
  const oldStr = (args?.old_string as string) || ''
  const newStr = (args?.new_string as string) || ''
  const diffContent = oldStr || newStr ? [
    oldStr ? `- ${oldStr.split('\n').join('\n- ')}` : '',
    newStr ? `+ ${newStr.split('\n').join('\n+ ')}` : ''
  ].filter(Boolean).join('\n') : ''

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: any) => {
    if (approvalSent) return
    setApprovalSent(approved ? 'approved' : mode === 'reject_soft' ? 'skipped' : 'stopped')
    onApprovalResponse?.(approved, scope, mode)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(diffContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="py-2.5">
      <CompactHeader 
        toolName="Edit"
        fileName={getFileName(filePath)} Icon={HiOutlinePencil}
        status={status} timingMs={timing_ms} approvalSent={approvalSent}
        needsApproval={!!pendingApproval}
      />
      
      <div className="ml-5 relative group/card">
        <FileCodePeek content={diffContent} filePath={filePath} isDiff onClick={() => setIsFullscreen(true)} />
        
        {/* Quick actions */}
        {diffContent && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button 
              onClick={handleCopy}
              className="p-1.5 bg-neutral-900/80 hover:bg-neutral-900 text-white rounded-lg shadow-lg border border-white/10 transition-all"
              title="Copy diff"
            >
              {copied ? <HiOutlineCheck className="w-3.5 h-3.5 text-green-400" /> : <HiOutlineClipboard className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title={`DIFF: ${filePath}`} maxWidth="max-w-7xl">
        <FileDiffSideBySideView oldContent={oldStr} newContent={newStr} filePath={filePath} />
      </Modal>

      {!!pendingApproval && status === 'running' && (
        <div className="mt-4 ml-5">
          <ApprovalButtons 
            approvalSent={approvalSent as any} onApproval={handleApproval} 
            toolName={name} description={pendingApproval.description} 
            batchRemaining={pendingApproval.batch_remaining}
          />
        </div>
      )}
    </div>
  )
}
