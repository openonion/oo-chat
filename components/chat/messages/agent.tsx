import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HiOutlineArrowDownTray } from 'react-icons/hi2'
import type { AgentUI } from '../types'
import { downloadImage, imageFileName } from '../utils'

export function Agent({ message }: { message: AgentUI }) {
  const content = typeof message.content === 'string' ? message.content : ''
  const images = Array.isArray(message.images) ? message.images : []
  const hasImages = images.length > 0
  const hasText = content.trim().length > 0

  if (!hasText && !hasImages) return null

  // Image-only items are tool output (e.g. take_screenshot streams an
  // agent_image event with no text) — render the image plainly, without the
  // avatar bubble that would make it look like the agent "said" something.
  if (!hasText) {
    return (
      <div className="py-2 pl-11">
        <AgentImages images={images} />
      </div>
    )
  }

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
              {content}
            </ReactMarkdown>
          </div>
        )}

        {/* Images - displayed below text */}
        {hasImages && <AgentImages images={images} />}
      </div>
    </div>
  )
}

function AgentImages({ images }: { images: string[] }) {
  return (
    <div className="flex w-full flex-col gap-3">
      {images.map((img, i) => (
        <div key={i} className="group relative w-fit">
          <img
            src={img}
            alt={`Image ${i + 1}`}
            className="w-full max-w-3xl max-h-[70vh] rounded-xl border border-neutral-200 object-contain bg-white shadow-md"
          />
          <button
            type="button"
            onClick={() => downloadImage(img, imageFileName(img, i))}
            aria-label="Download image"
            title="Download image"
            className="absolute top-2 right-2 rounded-lg bg-black/60 p-2 text-white opacity-100 lg:opacity-0 shadow-sm transition-opacity hover:bg-black/80 focus:opacity-100 lg:group-hover:opacity-100"
          >
            <HiOutlineArrowDownTray className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
