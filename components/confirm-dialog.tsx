'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** In-app replacement for window.confirm — themed, destructive action in red. */
export function ConfirmDialog({ open, title, body, confirmLabel = 'Delete', onConfirm, onCancel }: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  // Portal to <body>: callers may sit inside transformed ancestors (the sliding
  // sidebar), which would trap position:fixed and pin the dialog to that box.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="animate-in w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {body && <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{body}</p>}
        <div className="mt-5 flex justify-end gap-2">
          {/* No autoFocus: the opening tap would paint a heavy focus ring on Cancel,
              stealing weight from the red destructive action. ESC still cancels. */}
          <button
            onClick={onCancel}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
