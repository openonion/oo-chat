'use client'

import { Highlight, themes } from 'prism-react-renderer'
import { 
  HiOutlineCheck, 
  HiOutlineX, 
  HiOutlineArrowsExpand
} from 'react-icons/hi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '../../utils'
import { getLanguageFromPath, monokaiTheme, formatTime } from './file-utils'

// A file opens as a rendered markdown document when its extension says so, OR when it
// carries no code extension (.txt / extensionless) but its content clearly reads as
// markdown — agents often write prompts/reports as .txt. Code files (.py/.js/.json…)
// stay in the syntax-highlighted view. Diffs never switch (the +/- lines must stay visible).
const MARKDOWN_EXT_RE = /\.(md|markdown|mdx)$/i
const PLAIN_TEXT_RE = /\.txt$/i
const HAS_EXT_RE = /\.[a-z0-9]+$/i

function looksLikeMarkdown(content: string): boolean {
  // Require ≥2 distinct markdown signals so plain prose with a stray '#'/'*' isn't misread.
  const signals = [
    /^#{1,6}\s+\S/m,        // # heading
    /^\s*[-*+]\s+\S/m,      // - bullet list
    /^\s*\d+\.\s+\S/m,      // 1. ordered list
    /\*\*[^*\n]+\*\*/,      // **bold**
    /^>\s+\S/m,             // > blockquote
    /```/,                  // ``` fenced code
    /\[[^\]]+\]\([^)]+\)/,  // [text](url)
  ]
  return signals.filter(re => re.test(content)).length >= 2
}

function shouldRenderMarkdown(filePath: string, content: string, isDiff?: boolean): boolean {
  if (isDiff || !content) return false
  if (MARKDOWN_EXT_RE.test(filePath)) return true
  const name = filePath.split('/').pop() || ''
  const hasCodeExt = HAS_EXT_RE.test(name) && !PLAIN_TEXT_RE.test(name)
  if (hasCodeExt) return false
  return looksLikeMarkdown(content)
}

interface FileCodePeekProps {
  content: string
  filePath: string
  isDiff?: boolean
  maxLines?: number
  onClick?: () => void
}

export function FileCodePeek({ content, filePath, isDiff, maxLines = 4, onClick }: FileCodePeekProps) {
  if (!content) return null

  // Markdown files: light, rendered document snippet instead of the dark raw-source block.
  if (shouldRenderMarkdown(filePath, content, isDiff)) {
    const snippet = content.split('\n').slice(0, 12).join('\n')
    return (
      <div
        className="relative group bg-white border border-neutral-200 rounded-lg overflow-hidden max-h-36 cursor-pointer hover:border-neutral-300 transition-all shadow-sm"
        onClick={onClick}
      >
        <article className="prose prose-sm prose-neutral max-w-none px-4 py-3 pointer-events-none
          prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1
          prose-h1:text-base prose-h2:text-[15px] prose-h3:text-sm
          prose-p:my-1 prose-p:text-[13px] prose-p:text-neutral-600 prose-li:my-0.5 prose-li:text-[13px]
          prose-a:text-neutral-900 prose-strong:text-neutral-800
          prose-code:text-[12px] prose-code:before:content-none prose-code:after:content-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{snippet}</ReactMarkdown>
        </article>
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
        <div className="absolute right-2 bottom-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          <HiOutlineArrowsExpand className="w-3 h-3 text-neutral-400" />
        </div>
      </div>
    )
  }

  const lines = content.split('\n')
  const peekContent = lines.slice(0, maxLines).join('\n')

  return (
    <div
      className="relative group bg-neutral-50 rounded-lg overflow-hidden border border-neutral-200 hover:border-neutral-300 transition-all cursor-pointer shadow-sm"
      onClick={onClick}
    >
      <Highlight theme={themes.github} code={peekContent} language={getLanguageFromPath(filePath)}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="text-[11px] font-mono m-0 p-3 leading-relaxed pointer-events-none">
            {tokens.map((line, i) => {
              const lineContent = line.map(t => t.content).join('')
              const isAdd = isDiff && lineContent.trimStart().startsWith('+')
              const isDel = isDiff && lineContent.trimStart().startsWith('-')
              
              const lineProps = getLineProps({ line })
              if (isAdd) lineProps.className = cn(lineProps.className, "bg-green-900/20 block w-full")
              else if (isDel) lineProps.className = cn(lineProps.className, "bg-red-900/20 block w-full")
              else lineProps.className = cn(lineProps.className, "block w-full")

              return (
                <div key={i} {...lineProps} className="truncate">
                  <span className="opacity-90">
                    {line.map((token, key) => (<span key={key} {...getTokenProps({ token })} />))}
                  </span>
                </div>
              )
            })}
          </pre>
        )}
      </Highlight>
      
      <div className="absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-neutral-50 to-transparent opacity-90" />
      <div className="absolute right-2 bottom-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <HiOutlineArrowsExpand className="w-3 h-3 text-neutral-400" />
      </div>
    </div>
  )
}

export function FileFullView({ content, filePath, isDiff }: { content: string, filePath: string, isDiff?: boolean }) {
  // Markdown opens as a rendered document (headings/lists/bold/links), not raw `#`/`**`.
  // Diffs stay in the line-by-line code view so +/- lines remain visible.
  if (shouldRenderMarkdown(filePath, content, isDiff)) {
    return (
      <div className="h-full overflow-auto bg-white">
        <article className="prose prose-neutral max-w-3xl mx-auto px-8 py-8
          prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
          prose-p:leading-7 prose-li:my-0.5 prose-a:text-neutral-900 prose-a:underline prose-a:underline-offset-2
          prose-code:text-[13px] prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-neutral-100 prose-pre:text-neutral-800 prose-img:rounded-lg">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>
    )
  }
  return (
    <div className="relative group bg-white h-full overflow-auto">
      <Highlight theme={themes.github} code={content} language={getLanguageFromPath(filePath)}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="text-[12px] font-mono m-0 p-6 leading-relaxed min-w-full">
            {tokens.map((line, i) => {
              const lineContent = line.map(t => t.content).join('')
              const isAdd = isDiff && lineContent.trimStart().startsWith('+')
              const isDel = isDiff && lineContent.trimStart().startsWith('-')
              
              const lineProps = getLineProps({ line })
              if (isAdd) lineProps.className = cn(lineProps.className, "bg-green-900/30 block w-full")
              else if (isDel) lineProps.className = cn(lineProps.className, "bg-red-900/30 block w-full")
              else lineProps.className = cn(lineProps.className, "block w-full")

              return (
                <div key={i} {...lineProps}>
                  <span className="inline-block w-8 text-right pr-4 select-none text-neutral-600 text-[10px] opacity-50">
                    {i + 1}
                  </span>
                  <span className="opacity-90">
                    {line.map((token, key) => (<span key={key} {...getTokenProps({ token })} />))}
                  </span>
                </div>
              )
            })}
          </pre>
        )}
      </Highlight>
    </div>
  )
}

export function FileDiffSideBySideView({ oldContent, newContent, filePath }: { oldContent: string, newContent: string, filePath: string }) {
  return (
    <div className="flex h-full bg-[#1e1e1e] divide-x divide-neutral-800">
      {/* Left Column: Old */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-2 bg-[#252526] border-b border-neutral-800 text-[10px] font-bold text-neutral-500 uppercase tracking-widest sticky top-0 z-10">
          Original
        </div>
        <Highlight theme={monokaiTheme} code={oldContent || '// No content'} language={getLanguageFromPath(filePath)}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="text-[12px] font-mono m-0 p-6 leading-relaxed min-w-full">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="block w-full bg-red-900/10">
                  <span className="inline-block w-8 text-right pr-4 select-none text-neutral-600 text-[10px] opacity-40">
                    {i + 1}
                  </span>
                  <span className="opacity-90">
                    {line.map((token, key) => (<span key={key} {...getTokenProps({ token })} />))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>

      {/* Right Column: New */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-2 bg-[#252526] border-b border-neutral-800 text-[10px] font-bold text-neutral-500 uppercase tracking-widest sticky top-0 z-10">
          Changed
        </div>
        <Highlight theme={monokaiTheme} code={newContent || '// No content'} language={getLanguageFromPath(filePath)}>
          {({ tokens, getLineProps, getTokenProps }) => (
            <pre className="text-[12px] font-mono m-0 p-6 leading-relaxed min-w-full">
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })} className="block w-full bg-green-900/10">
                  <span className="inline-block w-8 text-right pr-4 select-none text-neutral-600 text-[10px] opacity-40">
                    {i + 1}
                  </span>
                  <span className="opacity-90">
                    {line.map((token, key) => (<span key={key} {...getTokenProps({ token })} />))}
                  </span>
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  )
}

interface CompactHeaderProps {
  toolName: string
  fileName: string
  Icon: any
  status: string
  timingMs?: number
  approvalSent?: string | null
  needsApproval: boolean
}

export function CompactHeader({ 
  toolName, fileName, Icon, status, timingMs, approvalSent, needsApproval 
}: CompactHeaderProps) {
  return (
    <div className="flex items-center gap-2 mb-2 group cursor-default">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <div className="w-4 h-4 flex items-center justify-center shrink-0">
          {status === 'done' ? (
            <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-neutral-100">
              <HiOutlineCheck className="w-2.5 h-2.5 text-neutral-600" />
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-red-100/50">
              <HiOutlineX className="w-2.5 h-2.5 text-red-600" />
            </div>
          ) : status === 'running' ? (
            <div className={cn(
              "w-1.5 h-1.5 rounded-full animate-pulse",
              needsApproval && !approvalSent ? "bg-neutral-400" : "bg-brand-500"
            )} />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
          )}
        </div>
        
        <Icon className="w-4 h-4 text-neutral-500 shrink-0" />
        <span className="text-sm font-bold text-neutral-700 tracking-tight shrink-0">{toolName}</span>
        <span className="text-xs font-bold text-neutral-500 truncate ml-1 font-mono tracking-tighter">{fileName}</span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {status === 'done' || status === 'error' ? (
          <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-widest tabular-nums">
            {status.toUpperCase()} {timingMs && `(${formatTime(timingMs)})`}
          </span>
        ) : needsApproval && approvalSent ? (
          <span className={cn("text-[10px] uppercase font-bold tracking-widest", approvalSent === 'skipped' ? "text-neutral-400" : "text-red-500")}>
            {approvalSent.toUpperCase()}
          </span>
        ) : needsApproval ? (
          <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest animate-pulse">Pending Approval</span>
        ) : (
          <span className="text-neutral-500 text-[10px] uppercase font-bold tracking-widest animate-pulse tabular-nums">Processing</span>
        )}
      </div>
    </div>
  )
}
