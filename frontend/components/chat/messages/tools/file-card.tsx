'use client'

import { useState } from 'react'
import { 
  HiOutlineCheck, 
  HiOutlineClipboard
} from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { Modal } from '@/components/ui/modal'
import { getFileName, getFileIcon } from './file-utils'
import { CompactHeader, FileCodePeek, FileFullView } from './file-components'

export function FileCard({ toolCall, pendingApproval, onApprovalResponse }: any) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [approvalSent, setApprovalSent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { name, args, status, result, timing_ms } = toolCall
  const filePath = (args?.file_path || args?.path || args?.filename || '') as string
  const content = (name.toLowerCase() === 'write' ? args?.content : result) || ''
  
  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: any) => {
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

  return (
    <div className="py-2.5">
      <CompactHeader 
        toolName={name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()}
        fileName={getFileName(filePath)} Icon={getFileIcon(name)}
        status={status} timingMs={timing_ms} approvalSent={approvalSent}
        needsApproval={!!pendingApproval}
      />
      
      <div className="ml-5 relative group/card">
        <FileCodePeek content={content} filePath={filePath} onClick={() => setIsFullscreen(true)} />
        
        {content && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button 
              onClick={handleCopy}
              className="p-1.5 bg-neutral-900/80 hover:bg-neutral-900 text-white rounded-lg shadow-lg border border-white/10 transition-all"
              title="Copy content"
            >
              {copied ? <HiOutlineCheck className="w-3.5 h-3.5 text-green-400" /> : <HiOutlineClipboard className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      <Modal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title={`${name.toUpperCase()}: ${filePath}`}>
        <FileFullView content={content} filePath={filePath} />
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
