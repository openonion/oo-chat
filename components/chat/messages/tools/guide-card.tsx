'use client'

import { useState } from 'react'
import { HiOutlineBookOpen, HiOutlineCheck, HiOutlineClipboard, HiOutlineChevronDown, HiOutlineChevronRight } from 'react-icons/hi'
import { Modal } from '@/components/ui/modal'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface GuideCardProps {
  toolCall: {
    name: string
    args?: { guide_path?: string }
    status: 'running' | 'done' | 'error'
    result?: string
    timing_ms?: number
  }
}

export function GuideCard({ toolCall }: GuideCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [copied, setCopied] = useState(false)

  const { args, status, result, timing_ms } = toolCall
  const guidePath = args?.guide_path || 'guide'
  const content = result || ''

  // Extract first heading for preview (remove # prefix)
  const firstHeading = content.split('\n').find(line => line.trim().startsWith('#'))?.replace(/^#+\s*/, '') || ''
  // Get a brief excerpt (first non-heading paragraph)
  const excerpt = content.split('\n').find(line => line.trim() && !line.trim().startsWith('#'))?.slice(0, 80) || ''

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const statusColor = status === 'done' ? 'text-green-500' : status === 'error' ? 'text-red-500' : 'text-amber-500'
  const statusIcon = status === 'done' ? '✓' : status === 'error' ? '✗' : '●'

  // Markdown code block renderer
  const components = {
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children).replace(/\n$/, '')

      if (!inline && match) {
        return (
          <SyntaxHighlighter
            style={oneDark}
            language={match[1]}
            PreTag="div"
            className="rounded-lg text-sm !my-3"
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        )
      }

      return (
        <code className="bg-neutral-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded text-neutral-800 dark:text-neutral-100 text-sm" {...props}>
          {children}
        </code>
      )
    }
  }

  return (
    <div className="py-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-1 -ml-1 transition-colors"
        >
          {isExpanded ? (
            <HiOutlineChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <HiOutlineChevronRight className="w-4 h-4 text-neutral-400" />
          )}
          <span className={statusColor}>{statusIcon}</span>
          <HiOutlineBookOpen className="w-4 h-4 text-blue-500" />
          <span className="font-medium">load_guide</span>
          <span className="text-neutral-500">({guidePath})</span>
        </button>
        {timing_ms !== undefined && (
          <span className="text-neutral-400 text-xs">{(timing_ms / 1000).toFixed(1)}s</span>
        )}
      </div>

      {/* Collapsed Preview */}
      {!isExpanded && content && (
        <button
          onClick={() => setIsExpanded(true)}
          className="ml-5 mt-1.5 text-left w-full"
        >
          <div className="text-xs text-neutral-600 dark:text-neutral-400 truncate max-w-md">
            {firstHeading && <span className="font-medium">{firstHeading}</span>}
            {firstHeading && excerpt && <span className="mx-1.5">·</span>}
            {excerpt && <span className="text-neutral-500">{excerpt}...</span>}
          </div>
        </button>
      )}

      {/* Expanded Content */}
      {isExpanded && content && (
        <div className="ml-5 mt-2 relative group/card">
          <div
            onClick={() => setIsFullscreen(true)}
            className="cursor-pointer rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 overflow-hidden hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
          >
            <div className="p-3 max-h-48 overflow-hidden relative">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-sm prose-headings:font-medium prose-headings:mt-2 prose-headings:mb-1 prose-headings:text-neutral-900 dark:prose-headings:text-neutral-100 prose-p:text-xs prose-p:my-1 prose-p:text-neutral-700 dark:prose-p:text-neutral-300 prose-li:text-xs prose-li:my-0 prose-li:text-neutral-700 dark:prose-li:text-neutral-300 prose-ul:my-1 prose-ol:my-1 prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100 prose-code:text-xs prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-neutral-800 dark:prose-code:text-neutral-100 prose-code:before:content-none prose-code:after:content-none">
                <ReactMarkdown components={components}>{content.slice(0, 800)}</ReactMarkdown>
              </div>
              {content.length > 500 && (
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-neutral-50 dark:from-neutral-900 to-transparent" />
              )}
            </div>
            <div className="px-3 py-1.5 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500">
              Click to view full guide
            </div>
          </div>

          {/* Copy button */}
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1 bg-neutral-900/80 hover:bg-neutral-900 text-white rounded shadow-lg border border-white/10 transition-all"
              title="Copy content"
            >
              {copied ? <HiOutlineCheck className="w-3 h-3 text-green-400" /> : <HiOutlineClipboard className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      <Modal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title={`Guide: ${guidePath}`}>
        <div className="prose prose-sm dark:prose-invert max-w-none p-4 prose-headings:mt-4 prose-headings:mb-2 prose-headings:text-neutral-900 dark:prose-headings:text-neutral-100 prose-p:my-2 prose-p:text-neutral-700 dark:prose-p:text-neutral-300 prose-li:my-0.5 prose-li:text-neutral-700 dark:prose-li:text-neutral-300 prose-ul:my-2 prose-ol:my-2 prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100 prose-blockquote:text-neutral-600 dark:prose-blockquote:text-neutral-400 prose-blockquote:border-l-blue-500 prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-neutral-800 dark:prose-code:text-neutral-100 prose-code:before:content-none prose-code:after:content-none prose-hr:border-neutral-300 dark:prose-hr:border-neutral-700">
          <ReactMarkdown components={components}>{content}</ReactMarkdown>
        </div>
      </Modal>
    </div>
  )
}
