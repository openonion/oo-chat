import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { UserUI } from '../types'

export function User({ message }: { message: UserUI }) {
  const hasImages = message.images && message.images.length > 0
  const hasText = message.content.trim().length > 0

  return (
    <div className="flex justify-end py-3">
      <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-neutral-900 text-white px-5 py-3.5 shadow-md">
        {/* Images */}
        {hasImages && (
          <div className={`grid gap-2 ${message.images!.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${hasText ? 'mb-3' : ''}`}>
            {message.images!.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Attachment ${i + 1}`}
                className="max-h-64 w-full rounded-xl object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(img, '_blank')}
              />
            ))}
          </div>
        )}

        {/* Text */}
        {hasText && (
          <div className="prose prose-sm prose-invert max-w-none text-[15px] leading-relaxed
            prose-p:my-0.5
            prose-code:bg-neutral-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-neutral-800 prose-pre:rounded-xl prose-pre:p-3 prose-pre:my-2
            prose-a:text-neutral-300 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
            prose-ul:my-1 prose-ol:my-1
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
