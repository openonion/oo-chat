import { useState } from "react";
import { HiOutlinePencil } from "react-icons/hi";
import { DraftEmailModal } from "./drafting-modal";

export function DraftEmailButton({ args }: { args: { to: string; subject: string; body: string } }) {
  const [showModal, setShowModal] = useState(false)
  const [sent, setSent] = useState(false)

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
      </div>

      {showModal && (
        <DraftEmailModal
          draft={args}
          onClose={() => setShowModal(false)}
          onSend={async (edited) => {
            const res = await fetch('http://localhost:8001/reply', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messageId: 'draft',
                body: `To: ${edited.to}\nSubject: ${edited.subject}\n\n${edited.body}`,
              }),
            })
            if (res.ok) setSent(true)
            setShowModal(false)
          }}
        />
      )}
    </>
  )
}