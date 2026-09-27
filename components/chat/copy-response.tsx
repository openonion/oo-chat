'use client'

import { useEffect, useRef, useState } from 'react'
import { HiOutlineCheck, HiOutlineClipboardDocument } from 'react-icons/hi2'

/** Copies the supplied response verbatim; no inferred files or commands. */
export function CopyResponse({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  const copy = async () => {
    if (timer.current) clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
    } catch {
      setState('error')
    }
    timer.current = setTimeout(() => setState('idle'), 2500)
  }

  return <button type="button" onClick={() => void copy()} aria-label="Copy response"
    className="flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 focus-visible:outline-2 focus-visible:outline-neutral-900">
    {state === 'copied' ? <HiOutlineCheck aria-hidden className="h-4 w-4" /> : <HiOutlineClipboardDocument aria-hidden className="h-4 w-4" />}
    <span role="status">{state === 'copied' ? 'Copied' : state === 'error' ? 'Could not copy · Retry' : 'Copy response'}</span>
  </button>
}
