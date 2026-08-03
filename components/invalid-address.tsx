/**
 * @purpose Stand in for an agent page when the address in the URL is not an address.
 * @llm-note Rendering the agent shell for one shows a name, a balance and a Top up
 *   button for something that does not exist, and the auto-add effect used to write
 *   the broken string into the stored agent list (#109).
 *
 *   "Offline" would be the wrong story: the agent is not the problem, the link is,
 *   and only one of those is the reader's to act on. Nothing here is actionable
 *   except going back to whoever sent it, so that is what it says.
 *
 *   One component because there are two routes under [address] and #109 fixed only
 *   the first — a forwarded *session* link with a clipped address still rendered a
 *   working composer. Shared so a third route cannot disagree with the other two.
 */
export function InvalidAddress({ address }: { address: string }) {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm font-medium text-neutral-900">That is not a valid agent link</p>
      <p className="max-w-xs text-sm text-neutral-500">
        An agent address is <span className="font-mono">0x</span> followed by 64 characters. This
        one is incomplete — ask whoever shared it for the full link.
      </p>
      <p className="mt-1 max-w-full truncate font-mono text-[11px] text-neutral-400">{address}</p>
    </main>
  )
}
