'use client'

import { useState } from 'react'
import { Highlight } from 'prism-react-renderer'
import type { ToolCallUI, PendingApproval } from '../../types'
import { 
  HiOutlineChevronRight, 
  HiOutlineChevronDown, 
  HiOutlineDocumentText, 
  HiOutlinePencil, 
  HiOutlineEye, 
  HiOutlineCheck, 
  HiOutlineX, 
  HiOutlineClipboard
} from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { cn } from '../../utils'

// Monokai theme for prism-react-renderer
const monokaiTheme = {
  plain: {
    color: '#F8F8F2',
    backgroundColor: '#1e1e1e',
  },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: '#75715E' } },
    { types: ['punctuation'], style: { color: '#F8F8F2' } },
    { types: ['property', 'tag', 'constant', 'symbol', 'deleted'], style: { color: '#F92672' } },
    { types: ['boolean', 'number'], style: { color: '#AE81FF' } },
    { types: ['selector', 'attr-name', 'string', 'char', 'builtin', 'inserted'], style: { color: '#E6DB74' } },
    { types: ['operator', 'entity', 'url', 'variable'], style: { color: '#F8F8F2' } },
    { types: ['atrule', 'attr-value', 'function', 'class-name'], style: { color: '#A6E22E' } },
    { types: ['keyword'], style: { color: '#F92672' } },
    { types: ['regex', 'important'], style: { color: '#FD971F' } },
  ],
}

interface FileCardProps {
  toolCall: ToolCallUI
  pendingApproval?: PendingApproval | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

function formatTime(ms: number): string {
  const seconds = ms / 1000
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.round(seconds)}s`
}

function getFileName(path: string): string {
  return path.split('/').pop() || path
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    'py': 'python',
    'js': 'javascript',
    'jsx': 'jsx',
    'ts': 'typescript',
    'tsx': 'tsx',
    'json': 'json',
    'md': 'markdown',
    'yaml': 'yaml',
    'yml': 'yaml',
    'sh': 'bash',
    'bash': 'bash',
    'css': 'css',
    'html': 'markup',
    'xml': 'markup',
    'sql': 'sql',
    'go': 'go',
    'rs': 'rust',
    'rb': 'ruby',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
  }
  return langMap[ext] || 'text'
}

function getFileIcon(toolName: string) {
  const name = toolName.toLowerCase()
  if (name === 'write') return HiOutlineDocumentText
  if (name === 'edit') return HiOutlinePencil
  if (name === 'read' || name === 'read_file') return HiOutlineEye
  return HiOutlineDocumentText
}

function getActionVerb(toolName: string, status: string, needsApproval: boolean): string {
  const name = toolName.toLowerCase()
  if (needsApproval) {
    if (name === 'write') return 'Write'
    if (name === 'edit') return 'Edit'
    if (name === 'read' || name === 'read_file') return 'Read'
    return 'Process'
  }
  const isRunning = status === 'running'
  if (name === 'write') return isRunning ? 'Writing' : 'Wrote'
  if (name === 'edit') return isRunning ? 'Editing' : 'Edited'
  if (name === 'read' || name === 'read_file') return isRunning ? 'Reading' : 'Read'
  return isRunning ? 'Processing' : 'Processed'
}

function countLines(content: string): number {
  return content.split('\n').length
}

function hasLineNumbers(content: string): boolean {
  const lines = content.split('\n').slice(0, 5)
  let numberedCount = 0
  for (const line of lines) {
    if (/^\s*\d+\s{2,}/.test(line) || /^\s*\d+\t/.test(line)) {
      numberedCount++
    }
  }
  return numberedCount >= 3
}

interface FileCodeViewProps {
  content: string
  filePath: string
  lineCount: number
  contentHasLineNumbers: boolean
  toolLower: string
}

function FileCodeView({ content, filePath, lineCount, contentHasLineNumbers, toolLower }: FileCodeViewProps) {
  const hasContent = content.length > 0

  return (
    <div className="relative group bg-[#1e1e1e]">
      {hasContent ? (
        <div className="overflow-x-auto">
          <Highlight
            theme={monokaiTheme}
            code={content}
            language={getLanguageFromPath(filePath)}
          >
            {({ tokens, getLineProps, getTokenProps }) => (
              <pre className="text-[12px] font-mono m-0 p-4 leading-relaxed min-w-full">
                {contentHasLineNumbers ? (
                  // Content already has line numbers
                  tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })} className="table-row">
                      <span className="table-cell">
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token })} />
                        ))}
                      </span>
                    </div>
                  ))
                ) : (
                  tokens.map((line, i) => {
                    const lineContent = line.map(t => t.content).join('')
                    const isDiff = toolLower === 'edit'
                    const isAdd = isDiff && lineContent.trimStart().startsWith('+')
                    const isDel = isDiff && lineContent.trimStart().startsWith('-')
                    
                    const lineProps = getLineProps({ line })
                    if (isAdd) {
                      lineProps.className = cn(lineProps.className, "bg-green-900/20 block w-full")
                    } else if (isDel) {
                      lineProps.className = cn(lineProps.className, "bg-red-900/20 block w-full")
                    } else {
                      lineProps.className = cn(lineProps.className, "block w-full")
                    }

                    return (
                      <div key={i} {...lineProps}>
                        <span className="inline-block w-8 text-right pr-4 select-none text-neutral-600 text-[10px] align-top opacity-50">
                          {i + 1}
                        </span>
                        <span className="opacity-90">
                          {line.map((token, key) => (
                            <span key={key} {...getTokenProps({ token })} />
                          ))}
                        </span>
                      </div>
                    )
                  })
                )}
              </pre>
            )}
          </Highlight>
        </div>
      ) : (
        <div className="p-8 text-center text-neutral-500 text-xs italic font-mono">
          {lineCount === 0 ? '// Operation completed (no content)' : '// No content available'}
        </div>
      )}
    </div>
  )
}

export function FileCard({ toolCall, pendingApproval, onApprovalResponse }: FileCardProps) {
  const { id, name, args, status, result, timing_ms } = toolCall
  const [isExpanded, setIsExpanded] = useState(true)
  const [approvalSent, setApprovalSent] = useState<'approved' | 'approved_session' | 'skipped' | 'stopped' | null>(null)
  const [copied, setCopied] = useState(false)

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

  const filePath = (args?.file_path || args?.path || args?.filename || '') as string
  const fileName = getFileName(filePath)
  const Icon = getFileIcon(name)
  const verb = getActionVerb(name, status, needsApproval)

  // Content to display based on tool type
  const toolLower = name.toLowerCase()
  let content = ''

  if (toolLower === 'write') {
    content = (args?.content as string) || ''
  } else if (toolLower === 'edit') {
    const oldStr = (args?.old_string as string) || ''
    const newStr = (args?.new_string as string) || ''
    if (oldStr || newStr) {
      const oldLines = oldStr ? `- ${oldStr.split('\n').join('\n- ')}` : ''
      const newLines = newStr ? `+ ${newStr.split('\n').join('\n+ ')}` : ''
      content = [oldLines, newLines].filter(Boolean).join('\n')
    }
  } else {
    content = result || ''
  }

  const hasContent = content.length > 0
  const lineCount = hasContent ? countLines(content) : 0
  const contentHasLineNumbers = hasContent && hasLineNumbers(content)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="my-2 flex flex-col gap-2">
      <div className="rounded-lg border border-neutral-800 bg-[#1e1e1e] overflow-hidden shadow-sm">
        <div
          className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-neutral-800 cursor-pointer select-none hover:bg-[#2a2d2e] transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2.5 overflow-hidden flex-1">
            <Icon className="w-4 h-4 text-blue-400 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-medium text-neutral-300 truncate font-mono">{fileName}</span>
              <span className="text-[10px] text-neutral-500 truncate">{filePath}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 pl-2 shrink-0">
             {/* Status Text */}
            <div className="flex items-center gap-2">
              {status === 'done' ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-green-500">
                  <HiOutlineCheck className="w-3 h-3" />
                  <span>Done {timing_ms && `(${formatTime(timing_ms)})`}</span>
                </span>
              ) : status === 'error' ? (
                <span className="flex items-center gap-1 text-[10px] font-medium text-red-500">
                  <HiOutlineX className="w-3 h-3" />
                  <span>Error</span>
                </span>
              ) : needsApproval && approvalSent ? (
                 <span className={cn(
                  "text-[10px] font-medium",
                  approvalSent === 'skipped' ? "text-amber-500" : "text-red-500"
                )}>
                  {approvalSent === 'skipped' ? 'Skipped' : 'Stopped'}
                </span>
              ) : needsApproval ? (
                <span className="text-[10px] font-medium text-amber-500 animate-pulse">
                  Approval Required
                </span>
              ) : (
                <span className="text-[10px] font-medium text-blue-400 animate-pulse">
                  Processing...
                </span>
              )}
            </div>

            {hasContent && (
              <button
                onClick={handleCopy}
                className="p-1 hover:bg-neutral-700 rounded text-neutral-400 hover:text-neutral-200 transition-colors"
                title="Copy content"
              >
                {copied ? <HiOutlineCheck className="w-3.5 h-3.5 text-green-500" /> : <HiOutlineClipboard className="w-3.5 h-3.5" />}
              </button>
            )}

            {isExpanded ? (
              <HiOutlineChevronDown className="w-3.5 h-3.5 text-neutral-500" />
            ) : (
              <HiOutlineChevronRight className="w-3.5 h-3.5 text-neutral-500" />
            )}
          </div>
        </div>

        {isExpanded && (
          <FileCodeView
            content={content}
            filePath={filePath}
            lineCount={lineCount}
            contentHasLineNumbers={contentHasLineNumbers}
            toolLower={toolLower}
          />
        )}
      </div>

      {needsApproval && status === 'running' && (
        <div className="ml-1">
          <ApprovalButtons
            approvalSent={approvalSent}
            onApproval={handleApproval}
            toolName={name}
            description={pendingApproval?.description}
            batchRemaining={pendingApproval?.batch_remaining}
          />
        </div>
      )}
    </div>
  )
}
