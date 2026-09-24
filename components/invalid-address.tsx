/**
 * @purpose Stand in for an agent page when the address in the URL is not an address.
 * @llm-note Rendering the agent shell for one shows a name, a balance and a Top up
 *   button for something that does not exist, and the auto-add effect used to write
 *   the broken string into the stored agent list (#109).
 *
 *   "Offline" would be the wrong story: the agent is not the problem, the link is.
 *   The reader can ask for the full link or return to agents already saved here.
 *
 *   One component because there are two routes under [address] and #109 fixed only
 *   the first — a forwarded *session* link with a clipped address still rendered a
 *   working composer. Shared so a third route cannot disagree with the other two.
 */
import Link from 'next/link'
import { HiOutlineExclamationCircle } from 'react-icons/hi'

export function InvalidAddress({ address }: { address: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
      <HiOutlineExclamationCircle aria-hidden="true" className="mb-4 h-7 w-7 text-neutral-400" />
      <h1 className="font-serif text-2xl font-semibold text-neutral-900">That is not a valid agent link</h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-neutral-600">
        An agent address is <span className="font-mono">0x</span> followed by 64 characters. This
        link does not match that format. Ask whoever shared it for the full link.
      </p>
      <p className="mt-3 max-w-full truncate font-mono text-xs text-neutral-500">{address}</p>
      <Link href="/" className="mt-7 inline-flex min-h-11 items-center rounded-lg bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-neutral-800">
        Go to your agents
      </Link>
    </div>
  )
}
