import { HiOutlineDocument } from 'react-icons/hi2'
import type { FilesReceivedUI } from '../types'

export function FilesReceived({ data }: { data: FilesReceivedUI }) {
  return (
    <div className="flex gap-2 flex-wrap py-2">
      {data.files.map((file, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2">
          <HiOutlineDocument className="h-4 w-4 text-neutral-400 shrink-0" />
          <span className="text-sm text-neutral-600">{file.name}</span>
        </div>
      ))}
    </div>
  )
}
