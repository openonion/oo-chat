'use client'

import { useState } from 'react'
import { HiOutlineClipboardList, HiOutlineCheck, HiOutlineClipboard, HiOutlineHeart, HiHeart, HiOutlineExclamationCircle, HiOutlineArrowsExpand } from 'react-icons/hi'
import { ApprovalButtons } from './approval-buttons'
import { Modal } from '@/components/ui/modal'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface PlanComment {
  id: string
  quotedText: string
  feedback: string
}

interface SectionReaction {
  sectionId: string
  type: 'like' | 'dislike'
  comment?: string
}

interface PlanSection {
  id: string
  content: string
  level: number  // heading level or 0 for paragraph
}

// Preview card prose (compact for preview)
const PLAN_PREVIEW_PROSE = [
  'prose prose-sm dark:prose-invert max-w-none',
  // Headings with hierarchy
  'prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2',
  'prose-headings:text-neutral-900 dark:prose-headings:text-neutral-50',
  'prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
  // Paragraphs
  'prose-p:text-sm prose-p:my-2 prose-p:leading-relaxed',
  'prose-p:text-neutral-700 dark:prose-p:text-neutral-200',
  // Lists
  'prose-li:text-sm prose-li:my-1',
  'prose-li:text-neutral-700 dark:prose-li:text-neutral-200',
  // Strong/Bold
  'prose-strong:text-neutral-900 dark:prose-strong:text-white',
  // Inline code
  'prose-code:bg-neutral-200 dark:prose-code:bg-neutral-700',
  'prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-xs',
  'prose-code:text-neutral-800 dark:prose-code:text-neutral-100',
  'prose-code:before:content-none prose-code:after:content-none'
].join(' ')

// Section card prose (improved readability)
const SECTION_PROSE = [
  'prose-headings:text-neutral-50 prose-headings:font-bold prose-headings:mt-0 prose-headings:mb-3',
  'prose-h1:text-lg prose-h2:text-base prose-h3:text-base',
  'prose-p:text-neutral-200 prose-p:text-base prose-p:my-3 prose-p:leading-7',
  'prose-ul:my-3 prose-ol:my-3 prose-li:text-neutral-200 prose-li:text-base prose-li:my-2 prose-li:leading-7',
  'prose-strong:text-neutral-50 prose-strong:font-bold',
  'prose-code:bg-blue-500/10 prose-code:text-blue-300 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono',
  'prose-code:before:content-none prose-code:after:content-none'
].join(' ')

interface PlanCardProps {
  toolCall: {
    name: string
    args?: { content?: string }
    status: 'running' | 'done' | 'error'
    result?: string
    timing_ms?: number
  }
  pendingApproval?: { description?: string; batch_remaining?: any[] } | null
  onApprovalResponse?: (approved: boolean, scope: 'once' | 'session', mode?: 'reject_soft' | 'reject_hard' | 'reject_explain', feedback?: string) => void
}

export function PlanCard({ toolCall, pendingApproval, onApprovalResponse }: PlanCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [approvalSent, setApprovalSent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Section reactions state
  const [reactions, setReactions] = useState<Record<string, SectionReaction>>({})

  const { name, args, status, result, timing_ms } = toolCall
  const content = args?.content || ''

  // Parse plan into sections
  const parseSections = (markdown: string): PlanSection[] => {
    const lines = markdown.split('\n')
    const sections: PlanSection[] = []
    let currentSection: string[] = []
    let sectionId = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const isHeading = line.match(/^#{1,3}\s/)
      const isNumberedItem = line.match(/^\d+\.\s/)
      const isSectionStart = isHeading || isNumberedItem

      if (isSectionStart && currentSection.length > 0) {
        // Save previous section
        const sectionContent = currentSection.join('\n').trim()
        if (sectionContent.length > 15) {
          sections.push({
            id: `section-${sectionId++}`,
            content: sectionContent,
            level: 0
          })
        }
        currentSection = [line]
      } else {
        currentSection.push(line)
      }
    }

    // Add final section
    if (currentSection.length > 0) {
      const sectionContent = currentSection.join('\n').trim()
      if (sectionContent.length > 15) {
        sections.push({
          id: `section-${sectionId++}`,
          content: sectionContent,
          level: 0
        })
      }
    }

    // If no sections found (no headings/numbered lists), treat whole content as one section
    if (sections.length === 0) {
      sections.push({
        id: 'section-0',
        content: markdown.trim(),
        level: 0
      })
    }

    return sections
  }

  const sections = parseSections(content)

  // Markdown code block renderer with syntax highlighting
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

  const handleReaction = (sectionId: string, type: 'like' | 'dislike') => {
    // Toggle off if clicking same reaction
    if (reactions[sectionId]?.type === type) {
      const newReactions = { ...reactions }
      delete newReactions[sectionId]
      setReactions(newReactions)
      return
    }

    // Set new reaction
    setReactions({
      ...reactions,
      [sectionId]: {
        sectionId,
        type,
        comment: type === 'dislike' ? (reactions[sectionId]?.comment || '') : undefined
      }
    })
  }

  const handleCommentChange = (sectionId: string, comment: string) => {
    if (reactions[sectionId]) {
      setReactions({
        ...reactions,
        [sectionId]: {
          ...reactions[sectionId],
          comment
        }
      })
    }
  }

  const handleApproval = (approved: boolean, scope: 'once' | 'session', mode?: any) => {
    if (approvalSent) return

    // Format reactions as feedback (only dislikes)
    let feedback = undefined
    const dislikes = Object.values(reactions).filter(r => r.type === 'dislike')

    if (!approved && dislikes.length > 0) {
      feedback = dislikes.map(r => {
        const section = sections.find(s => s.id === r.sectionId)
        const sectionPreview = section?.content.slice(0, 100) || ''
        return `⚠️ Don't do this way:\n> ${sectionPreview}...\n\n${r.comment || 'This section needs changes'}`
      }).join('\n\n---\n\n')
    }

    setApprovalSent(approved ? 'approved' : mode === 'reject_soft' ? 'skipped' : 'stopped')
    onApprovalResponse?.(approved, scope, mode, feedback)
  }

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Status indicator
  const statusBg = status === 'done' ? 'bg-green-500/10 text-green-600 dark:text-green-400' : status === 'error' ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
  const statusIcon = status === 'done' ? '✓' : status === 'error' ? '✗' : '●'

  return (
    <div className="py-2.5">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setIsFullscreen(true)}
          className="flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded px-1 -ml-1 transition-colors"
        >
          <span className={`flex items-center justify-center w-5 h-5 rounded-full ${statusBg}`}>
            <span className="text-xs font-bold">{statusIcon}</span>
          </span>
          <HiOutlineClipboardList className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-sm">Implementation Plan</span>
        </button>
        {timing_ms !== undefined && (
          <>
            <span className="text-neutral-300 dark:text-neutral-600">•</span>
            <span className="text-neutral-500 dark:text-neutral-400 text-sm">{(timing_ms / 1000).toFixed(1)}s</span>
          </>
        )}
        {pendingApproval && status === 'running' && !approvalSent && (
          <span className="text-amber-500 text-xs ml-auto">awaiting approval</span>
        )}
        {approvalSent && (
          <span className={`text-xs ml-auto ${approvalSent === 'approved' ? 'text-green-500' : 'text-red-400'}`}>
            {approvalSent}
          </span>
        )}
        {Object.keys(reactions).length > 0 && (
          <span className="flex items-center gap-1.5 bg-blue-500/20 text-blue-400 text-xs font-medium px-2 py-1 rounded-full">
            {Object.values(reactions).filter(r => r.type === 'like').length > 0 && <HiHeart className="w-3 h-3 text-pink-400" />}
            {Object.values(reactions).filter(r => r.type === 'dislike').length > 0 && <HiOutlineExclamationCircle className="w-3 h-3 text-red-400" />}
            {Object.keys(reactions).length}
          </span>
        )}
      </div>

      {/* Plan Preview */}
      <div className="ml-5 mt-2 relative group/card">
        <div
          onClick={() => setIsFullscreen(true)}
          className="cursor-pointer rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900 overflow-hidden hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
        >
          <div className="p-4 max-h-64 overflow-hidden relative">
            <div className={PLAN_PREVIEW_PROSE}>
              <ReactMarkdown components={components}>{content.slice(0, 1500)}</ReactMarkdown>
            </div>
            {content.length > 1500 && (
              <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-neutral-50 via-neutral-50/60 to-transparent dark:from-neutral-900 dark:via-neutral-900/60 dark:to-transparent pointer-events-none" />
            )}
          </div>
          {content.length > 500 && (
            <div className="px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
              <HiOutlineArrowsExpand className="w-3.5 h-3.5" />
              Click to view full plan
            </div>
          )}
        </div>

        {/* Copy button */}
        {content && (
          <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 transition-all"
              title="Copy plan"
            >
              {copied ? <HiOutlineCheck className="w-3.5 h-3.5 text-green-400" /> : <HiOutlineClipboard className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}
      </div>

      {/* Fullscreen Modal with Reactions */}
      <Modal isOpen={isFullscreen} onClose={() => setIsFullscreen(false)} title="Review Plan" maxWidth="max-w-5xl">
        <div className="flex flex-col h-full">
          {/* Header with Progress */}
          <div className="px-6 py-5 border-b border-neutral-800 bg-neutral-900">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-neutral-100 mb-1">Review Plan</h3>
                  <p className="text-sm text-neutral-400">React to sections that need attention</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-neutral-100">
                    {Object.keys(reactions).length}/{sections.length}
                  </div>
                  <div className="text-xs text-neutral-500">sections reviewed</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${(Object.keys(reactions).length / sections.length) * 100}%` }}
                />
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-pink-400">
                  <HiHeart className="w-4 h-4" />
                  <span className="font-semibold">{Object.values(reactions).filter(r => r.type === 'like').length}</span>
                  loved
                </span>
                <span className="flex items-center gap-1.5 text-orange-400">
                  <HiOutlineExclamationCircle className="w-4 h-4" />
                  <span className="font-semibold">{Object.values(reactions).filter(r => r.type === 'dislike').length}</span>
                  need changes
                </span>
                <span className="text-neutral-500">
                  {sections.length - Object.keys(reactions).length} neutral (approved)
                </span>
              </div>
            </div>
          </div>

          {/* Sections List */}
          <div className="flex-1 overflow-auto px-6 py-6 space-y-6">
            {sections.map((section, index) => {
              const reaction = reactions[section.id]
              const isLiked = reaction?.type === 'like'
              const isDisliked = reaction?.type === 'dislike'

              return (
                <div
                  key={section.id}
                  className={`rounded-xl border-2 transition-all shadow-lg relative ${
                    isLiked
                      ? 'border-pink-500/40 bg-pink-500/5 shadow-pink-500/10'
                      : isDisliked
                      ? 'border-orange-500/40 bg-orange-500/5 shadow-orange-500/10'
                      : 'border-neutral-700/50 bg-neutral-800/80 shadow-black/20 hover:border-neutral-600'
                  }`}
                >
                  {/* Section Number Badge */}
                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-neutral-700 border-2 border-neutral-600 flex items-center justify-center text-sm font-bold text-neutral-200">
                    {index + 1}
                  </div>

                  {/* Three Action Buttons - Top Right (Always Visible) */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button
                      onClick={() => handleReaction(section.id, 'like')}
                      className={`group relative px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-xl hover:scale-105 ${
                        isLiked
                          ? 'bg-pink-500 text-white ring-2 ring-pink-400'
                          : 'bg-neutral-700 text-neutral-300 hover:bg-pink-500 hover:text-white'
                      }`}
                      title="Love this section"
                    >
                      <span className="flex items-center gap-2">
                        {isLiked ? <HiHeart className="w-5 h-5" /> : <HiOutlineHeart className="w-5 h-5" />}
                        Love
                      </span>
                    </button>
                    <button
                      onClick={() => handleReaction(section.id, 'dislike')}
                      className={`group relative px-4 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md hover:shadow-xl hover:scale-105 ${
                        isDisliked
                          ? 'bg-orange-500 text-white ring-2 ring-orange-400'
                          : 'bg-neutral-700 text-neutral-300 hover:bg-orange-500 hover:text-white'
                      }`}
                      title="Provide feedback"
                    >
                      <span className="flex items-center gap-2">
                        <HiOutlineExclamationCircle className="w-5 h-5" />
                        Feedback
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (reaction) {
                          handleReaction(section.id, reaction.type)
                        }
                      }}
                      disabled={!reaction}
                      className={`px-3 py-2.5 rounded-lg font-bold text-sm transition-all shadow-md ${
                        reaction
                          ? 'bg-neutral-600 text-neutral-200 hover:bg-red-500 hover:text-white hover:shadow-xl hover:scale-105'
                          : 'bg-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'
                      }`}
                      title={reaction ? "Clear reaction" : "No reaction to clear"}
                    >
                      <span className="flex items-center gap-1">
                        ✕
                      </span>
                    </button>
                  </div>

                  {/* Section Content */}
                  <div className="p-6 pr-40">
                    <div className={`${SECTION_PROSE}`}>
                      <ReactMarkdown components={components}>
                        {section.content}
                      </ReactMarkdown>
                    </div>
                  </div>

                  {/* Love Feedback Message */}
                  {isLiked && (
                    <div className="px-6 pb-6">
                      <div className="flex items-center gap-3 bg-pink-500/15 border border-pink-500/30 rounded-lg p-4">
                        <HiHeart className="w-6 h-6 text-pink-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-base text-pink-200 font-semibold">I love this section!</p>
                          <p className="text-sm text-pink-300/70 mt-1">This part looks great</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Change Feedback Form */}
                  {isDisliked && (
                    <div className="px-6 pb-6">
                      <div className="bg-orange-500/15 border border-orange-500/30 rounded-lg p-5 space-y-4">
                        <div className="flex items-start gap-3">
                          <HiOutlineExclamationCircle className="w-6 h-6 text-orange-400 shrink-0 mt-1" />
                          <div className="flex-1">
                            <p className="text-base text-orange-200 font-semibold mb-1">Don't do this way</p>
                            <p className="text-sm text-orange-300/70">Share what needs to change:</p>
                          </div>
                        </div>
                        <textarea
                          value={reaction.comment || ''}
                          onChange={(e) => handleCommentChange(section.id, e.target.value)}
                          placeholder="Explain what's wrong and how to improve it..."
                          className="w-full bg-neutral-900 text-neutral-100 text-base rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-neutral-500 resize-none leading-relaxed"
                          rows={4}
                          autoFocus
                        />
                        <div className="flex items-center justify-between text-xs text-neutral-400">
                          <span>{(reaction.comment || '').length} characters</span>
                          <span className="text-orange-400">Required for feedback</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Footer Summary */}
          <div className="px-6 py-5 border-t border-neutral-800 bg-neutral-900">
            {Object.values(reactions).filter(r => r.type === 'dislike').length > 0 ? (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                  <HiOutlineExclamationCircle className="w-6 h-6 text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-orange-300 mb-1">
                    {Object.values(reactions).filter(r => r.type === 'dislike').length} section
                    {Object.values(reactions).filter(r => r.type === 'dislike').length !== 1 ? 's' : ''} need changes
                  </p>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    Your feedback will be sent when you click "Request Changes" below. I'll revise the plan based on your suggestions.
                  </p>
                </div>
              </div>
            ) : Object.values(reactions).filter(r => r.type === 'like').length > 0 ? (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-pink-500/20 flex items-center justify-center shrink-0">
                  <HiHeart className="w-6 h-6 text-pink-400" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-pink-300 mb-1">
                    Plan looks great!
                  </p>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    You loved {Object.values(reactions).filter(r => r.type === 'like').length} section
                    {Object.values(reactions).filter(r => r.type === 'like').length !== 1 ? 's' : ''}. Ready to proceed when you approve below.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                  <HiOutlineCheck className="w-6 h-6 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-base font-bold text-green-300 mb-1">
                    All sections look good
                  </p>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    No feedback needed. All sections are approved by default. Click "Approve" below to proceed.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Approval Buttons */}
      {!!pendingApproval && status === 'running' && (
        <div className="mt-4 ml-5">
          <ApprovalButtons
            approvalSent={approvalSent as any}
            onApproval={handleApproval}
            toolName={name}
            description={pendingApproval.description}
            batchRemaining={pendingApproval.batch_remaining}
          />
        </div>
      )}
    </div>
  )
}
