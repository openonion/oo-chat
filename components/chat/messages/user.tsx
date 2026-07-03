import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { HiOutlineDocument, HiOutlineArrowDownTray } from 'react-icons/hi2'
import type { UserUI } from '../types'
import { downloadImage, imageFileName } from '../utils'

export function User({ message }: { message: UserUI }) {
  const content = typeof message.content === 'string' ? message.content : ''
  const images = Array.isArray(message.images) ? message.images : []
  const files = Array.isArray(message.files) ? message.files : []
  const hasImages = images.length > 0
  const hasFiles = files.length > 0
  const hasText = content.trim().length > 0

  return (
    <div className="flex flex-col items-end gap-2 py-3">
      {/* Images - displayed as thumbnails above text */}
      {hasImages && (
        <div className={`flex gap-2 flex-wrap justify-end max-w-[85%]`}>
          {images.map((img, i) => (
            <div key={i} className="group relative w-fit">
              <img
                src={img}
                alt={`Attachment ${i + 1}`}
                className="max-h-48 max-w-[200px] rounded-2xl object-contain shadow-md"
              />
              <button
                type="button"
                onClick={() => downloadImage(img, imageFileName(img, i))}
                aria-label="Download image"
                title="Download image"
                className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white opacity-0 shadow-sm transition-opacity hover:bg-black/80 focus:opacity-100 group-hover:opacity-100"
              >
                <HiOutlineArrowDownTray className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* File attachments */}
      {hasFiles && (
        <div className="flex gap-2 flex-wrap justify-end max-w-[85%]">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl bg-neutral-800 px-3 py-2 shadow-md">
              <HiOutlineDocument className="h-4 w-4 text-neutral-400 shrink-0" />
              <span className="text-sm text-neutral-200 truncate max-w-[150px]">{file.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Text bubble */}
      {hasText && (
        <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-neutral-900 text-white px-5 py-3.5 shadow-md">
          <div className="prose prose-sm prose-invert max-w-none text-[15px] leading-relaxed
            prose-p:my-0.5
            prose-code:bg-neutral-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-[13px] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-neutral-800 prose-pre:rounded-xl prose-pre:p-3 prose-pre:my-2
            prose-a:text-neutral-300 prose-a:font-medium prose-a:no-underline hover:prose-a:underline
            prose-ul:my-1 prose-ol:my-1
          ">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
