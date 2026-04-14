import { useState } from "react";
import { HiOutlinePencil } from "react-icons/hi";
import { DraftEmailModal } from "./drafting-modal";

export function DraftEmailButton({ args }: { args: { to: string; subject: string; body: string } }) {
  const [showModal, setShowModal] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (sent) {
    return (
      <div className="ml-11 my-2 flex items-center gap-2 rounded-xl bg-green-50 
                        border border-green-200 px-4 py-3 text-sm text-green-700">
        <span>✓</span>
        <span>Email sent successfully</span>
      </div>
    )
  }

  return (
    <>
      <div className="ml-11 my-2">
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-xl bg-white border border-neutral-200 
                      px-4 py-3 text-sm text-neutral-700 font-medium
                      hover:bg-neutral-50 hover:border-neutral-300 transition-all
                      shadow-sm hover:shadow"
        >
          <HiOutlinePencil className="w-4 h-4" />
          Review Draft
        </button>
        {error && (
          <p className="text-xs text-red-500 mt-1 ml-1">{error}</p>
        )}
      </div>

      {showModal && (
        <DraftEmailModal
          draft={args}
          onClose={() => setShowModal(false)}
          onSend={async (edited) => {
            setError(null)
            try {
              const res = await fetch('/api/drafting/send_draft', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: edited.to,
                  subject: edited.subject,
                  body: edited.body,
                }),
              })
              const json = await res.json()
              if (!res.ok || json.ok !== true) {
                setError(json.error || 'Failed to send email')
                setShowModal(false)
                return
              }
              setSent(true)
              setShowModal(false)
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Network error')
              setShowModal(false)
            }
          }}
        />
      )}
    </>
  )
}
