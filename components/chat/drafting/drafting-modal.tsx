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
  const [body, setBody] = useState(draft.body.replace(/\\n/g, '\n'))
  const [sending, setSending] = useState(false)
  const [showAssistant, setShowAssistant] = useState(false)
  const [assistantInstruction, setAssistantInstruction] = useState('')
  const [refining, setRefining] = useState(false)
  const [refineError, setRefineError] = useState<string | null>(null)

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

        <div className="block">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">Body</span>
            <button
              type="button"
              className="text-xs font-medium text-neutral-700 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none"
              disabled={sending || refining}
              onClick={() => setShowAssistant((v) => !v)}
            >
              {showAssistant ? 'Hide assistant' : 'Edit with assistant'}
            </button>
          </div>
          {showAssistant && (
            <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2.5 space-y-2">
              <label
                htmlFor="draft-assist-instruction"
                className="text-xs font-medium text-neutral-600 block"
              >
                Tell the assistant how to change this reply
              </label>
              <textarea
                id="draft-assist-instruction"
                rows={2}
                className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                placeholder="e.g. Shorter, more formal, mention Friday deadline"
                value={assistantInstruction}
                onChange={(e) => setAssistantInstruction(e.target.value)}
                disabled={refining}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-neutral-900 text-white text-xs font-medium px-3 py-1.5 hover:bg-neutral-800 disabled:opacity-50 disabled:pointer-events-none"
                  disabled={refining}
                  onClick={async () => {
                    const trimmed = assistantInstruction.trim()
                    if (!trimmed) {
                      setRefineError('Describe how you want the reply changed.')
                      return
                    }
                    setRefining(true)
                    setRefineError(null)
                    try {
                      const res = await fetch('/api/automation/refine-draft', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          instruction: trimmed,
                          currentDraft: body,
                          subject,
                          from: to,
                        }),
                      })
                      const json = (await res.json()) as {
                        ok?: boolean
                        draftBody?: string
                        error?: string
                      }
                      if (!res.ok || !json.ok || !json.draftBody) {
                        setRefineError(json.error || res.statusText || 'Could not update draft')
                        return
                      }
                      setBody(json.draftBody)
                      setAssistantInstruction('')
                      setShowAssistant(false)
                    } catch (e) {
                      setRefineError(e instanceof Error ? e.message : 'Network error')
                    } finally {
                      setRefining(false)
                    }
                  }}
                >
                  {refining ? 'Updating…' : 'Apply to draft'}
                </button>
                {refineError && (
                  <span className="text-xs text-red-600">{refineError}</span>
                )}
              </div>
            </div>
          )}
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            rows={8}
            className="w-full mt-2 px-3 py-2 border border-neutral-200 rounded-lg text-sm
                       resize-y focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 outline-none"
          />
        </div>

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