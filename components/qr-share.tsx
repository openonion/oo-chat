'use client'

import { useEffect, useRef, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { HiOutlineQrcode, HiOutlineX, HiOutlineClipboardCopy, HiOutlineClipboardCheck } from 'react-icons/hi'

/** Production oo-chat frontend. The QR always points here so a scan opens the
 *  real site, not whatever origin the code is served from (localhost / preview). */
const OO_CHAT_BASE = 'https://chat.openonion.ai'

/**
 * A "scan to open on your phone" affordance for an agent.
 *
 * The QR encodes this agent's full oo-chat URL (`${OO_CHAT_BASE}/${address}`), not
 * the bare 0x address — a phone camera only jumps to http(s) URLs, so encoding the
 * address alone would just surface unactionable text. Generation is fully
 * client-side (no address leaves the tab).
 */
export function QrShare({ address }: { address: string }) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const openerRef = useRef<HTMLButtonElement>(null)

  // Announced, focusable, and dismissible. Without a dialog role and a focus
  // move, opening this changed nothing a screen reader could perceive — the
  // content was appended to the page, focus stayed on the button behind it, and
  // Tab carried on through the page underneath. onboard-gate.tsx already does
  // this properly; this one simply never did.
  //
  // Escape closes, unlike the invite gate, because dismissing this leaves a
  // usable page — there the honest answer to "can I get out of this" is no.
  useEffect(() => {
    if (!open) return
    // Captured now: by cleanup the ref may point somewhere else, and the whole
    // point is to return focus to the button this was opened from.
    const opener = openerRef.current
    closeRef.current?.focus()
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Back where they were, not at the top of the document.
      opener?.focus()
    }
  }, [open])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [open])

  const url = `${OO_CHAT_BASE}/${address}`

  const handleCopy = async () => {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Scan to open on your phone"
        // The visible word has to be inside the accessible name — WCAG 2.5.3.
        // With the name "Show QR code" against a button reading "Share", a
        // speech-input user saying "click Share" activates nothing, and there is
        // no feedback to tell them why.
        aria-label="Share — show QR code"
        ref={openerRef}
        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
      >
        <HiOutlineQrcode className="w-3.5 h-3.5 text-neutral-400" />
        Share
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="qr-share-title"
            className="relative w-full max-w-xs rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200"
          >
            <button
              ref={closeRef}
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <HiOutlineX className="w-4 h-4" />
            </button>

            <p id="qr-share-title" className="text-center text-sm font-medium text-neutral-900">Scan to open on your phone</p>
            <p className="mt-1 mb-5 text-center text-[11px] text-neutral-400">Point your camera at the code</p>

            <div className="flex justify-center">
              <div className="rounded-xl border border-neutral-200 bg-white p-3">
                <QRCodeSVG value={url} size={200} level="M" marginSize={0} />
              </div>
            </div>

            <button
              onClick={handleCopy}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-medium text-neutral-600 hover:border-neutral-300 hover:bg-white transition-colors"
            >
              {copied ? (
                <><HiOutlineClipboardCheck className="w-4 h-4 text-green-600" /> Copied</>
              ) : (
                <><HiOutlineClipboardCopy className="w-4 h-4" /> Copy link</>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
