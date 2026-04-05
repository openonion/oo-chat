import { useState } from "react";

export function DraftEmailModal({
  draft,
  onClose,
  onSend,
}: {
  draft: { to: string; subject: string; body: string }
  onClose: () => void
  onSend: (edited: { to: string; subject: string; body: string }) => Promise<void>
}) {
  const [to, setTo] = useState(draft.to)
  const [subject, setSubject] = useState(draft.subject)
  const [body, setBody] = useState(draft.body)
  const [sending, setSending] = useState(false)

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Edit Draft</h2>

        <label className="block">
          <span className="text-xs text-neutral-500">To</span>
          <input
            value={to}
            onChange={e => setTo(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm
                       focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-500">Subject</span>
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm
                       focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs text-neutral-500">Body</span>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            className="w-full mt-1 px-3 py-2 border border-neutral-200 rounded-lg text-sm
                       resize-y focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 outline-none"
          />
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 
                       rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={sending}
            onClick={async () => {
              setSending(true)
              await onSend({ to, subject, body })
            }}
            className="px-4 py-2 text-sm bg-neutral-900 text-white rounded-lg
                       hover:bg-neutral-800 transition-colors disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}