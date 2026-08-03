'use client'

import { useState } from 'react'
import { HiOutlineCheck, HiOutlineClipboardCopy } from 'react-icons/hi'

/** The agent's public key, shown in full on click and copyable in one press.
 *
 *  It is the only durable name an agent has — the display name is whatever the
 *  agent chose to publish and can change. It is also what a top-up is addressed
 *  to, so someone paying for an agent needs to be able to read and check it. */
export function AgentAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    // Two sibling buttons, not a button inside a button: nesting them is invalid
    // HTML, and assistive technology resolves the pair ambiguously — the outer
    // control ends up announcing the inner one's label as part of its own name.
    <span className="group inline-flex max-w-full items-center gap-1.5 rounded-full border border-neutral-200 bg-white pl-3 pr-1 py-1 text-[11px] font-mono text-neutral-500 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
      <button
        onClick={() => setExpanded(v => !v)}
        title={expanded ? 'Show less' : address}
        aria-expanded={expanded}
        className="inline-flex min-h-6 min-w-0 items-center text-left"
      >
        <span className={expanded ? 'break-all' : 'block truncate'}>
          {expanded ? address : `${address.slice(0, 10)}\u2026${address.slice(-6)}`}
        </span>
      </button>
      <button
        onClick={copy}
        aria-label="Copy agent address"
        className="inline-flex min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full text-neutral-400 transition-colors hover:text-neutral-700"
      >
        {copied
          ? <HiOutlineCheck className="h-3.5 w-3.5 text-green-600" />
          : <HiOutlineClipboardCopy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
}

/** Anyone can pay for any address — the checkout endpoint takes an address and no
 *  auth. The purchase page reads it from `?key=`; any other parameter name lands
 *  on an empty form and the payer has to paste the address themselves.
 *
 *  Only rendered when the agent published a balance, which only co/* managed-key
 *  agents do. That is also the proof the address exists in the backend: checkout
 *  404s with "User not found" for an address that never authenticated. */
export function TopUp({ address, balanceUsd }: { address: string; balanceUsd: number }) {
  const empty = balanceUsd <= 0
  const low = isLowBalance(balanceUsd)

  return (
    <a
      href={purchaseUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title="Add credits to this agent"
      className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition-colors ${
        low
          ? 'border-red-200 bg-red-50 text-red-700 hover:border-red-300'
          : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:bg-neutral-50'
      }`}
    >
      {/* At zero the number is the least useful thing on the pill — "$0.00" reads
          as a balance like any other, and the reader has to know what it implies.
          Say the implication instead. */}
      {empty ? (
        <span className="font-semibold">Out of credits</span>
      ) : (
        <span className={`font-mono tabular-nums ${low ? 'text-red-700' : 'text-neutral-900'}`}>
          ${balanceUsd.toFixed(2)}
        </span>
      )}
      <span className={low ? 'text-red-600' : 'text-neutral-400 transition-colors group-hover:text-neutral-700'}>
        Top up →
      </span>
    </a>
  )
}

/** Below one dollar an agent is a turn or two from refusing, which is close
 *  enough that the reader should hear about it before it happens rather than
 *  after. Above it, silence — a balance nobody needs to act on is clutter. */
export function isLowBalance(balanceUsd: number) {
  return balanceUsd < 1
}

/** The purchase page reads the address from `?key=`; any other parameter name
 *  lands the payer on an empty form with the address to paste themselves. */
export function purchaseUrl(address: string) {
  return `https://o.openonion.ai/purchase?key=${address}`
}

/** Shown with the composer, not in the transcript, because the transcript can be
 *  scrolled away from and this is the one notice that has to still be there when
 *  the reader looks back down to type. */
export function LowBalanceNotice({ address, balanceUsd }: { address: string; balanceUsd: number }) {
  const empty = balanceUsd <= 0

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-red-100 bg-red-50 px-4 py-2 text-[11px] text-red-700">
      <span>
        {empty
          ? 'This agent is out of credits and will stop responding.'
          : `Running low — $${balanceUsd.toFixed(2)} left.`}
      </span>
      <a
        href={purchaseUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-6 items-center font-semibold underline underline-offset-2 hover:text-red-800"
      >
        Add credits
      </a>
    </div>
  )
}
