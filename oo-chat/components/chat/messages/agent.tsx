import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentUI } from '../types'

export function Agent({ message }: { message: AgentUI }) {
  const hasImages = message.images && message.images.length > 0
  const hasText = message.content.trim().length > 0

  return (
    <div className="flex justify-start py-3 gap-3">
      {/* Agent avatar */}
      <div className="shrink-0 w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-xs">O</span>
      </div>
      <div className="max-w-[85%] text-neutral-800 flex flex-col gap-2">
        {/* Text content */}
        {hasText && (
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
            prose-a:text-neutral-900 prose-a:font-medium prose-a:underline prose-a:underline-offset-2 prose-a:decoration-neutral-300 hover:prose-a:decoration-neutral-900
            prose-blockquote:border-l-4 prose-blockquote:border-neutral-200 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-neutral-600
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Images - displayed below text */}
        {hasImages && (
          <div className="flex gap-2 flex-wrap">
            {message.images!.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Image ${i + 1}`}
                className="max-h-48 max-w-[200px] rounded-2xl object-contain cursor-pointer hover:opacity-90 transition-opacity shadow-md"
                onClick={() => window.open(img, '_blank')}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
