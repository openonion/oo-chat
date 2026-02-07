import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentUI } from '../types'

export function Agent({ message }: { message: AgentUI }) {
  return (
    <div className="flex justify-start py-3 gap-3">
      {/* Agent avatar */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-xs">O</span>
      </div>
      <div className="max-w-[85%] text-neutral-800">
        <div className="prose prose-sm prose-neutral max-w-none text-[15px] leading-7
          prose-headings:font-semibold prose-headings:text-neutral-900 prose-headings:mt-4 prose-headings:mb-2
          prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
          prose-p:my-2
          prose-code:bg-neutral-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-medium prose-code:text-neutral-800 prose-code:before:content-none prose-code:after:content-none
          prose-pre:bg-[#1e1e1e] prose-pre:rounded-xl prose-pre:text-sm prose-pre:p-4 prose-pre:my-4 prose-pre:shadow-sm
          [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-neutral-100 [&_pre_code]:font-mono
          prose-table:text-sm prose-th:bg-neutral-50 prose-th:px-4 prose-th:py-2 prose-th:font-semibold prose-td:px-4 prose-td:py-2 prose-td:border-t prose-td:border-neutral-100
          prose-ul:my-3 prose-li:my-1
          prose-ol:my-3
          prose-a:text-indigo-600 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-l-4 prose-blockquote:border-neutral-200 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-600
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
