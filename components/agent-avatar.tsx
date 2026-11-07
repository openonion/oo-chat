import Image from 'next/image'

/** A stable hue per address, so two agents both called "oo" look different.
 *  Drawn from 200°–60° (blue through red to amber): green stays the selected
 *  agent's identity colour, so no unselected tile can be mistaken for it. */
function addressHue(address: string): number {
  let hash = 0
  for (const char of address) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (200 + (hash % 220)) % 360
}

/**
 * An agent's tile: a soft square with its initial.
 *
 * Soft on purpose. A solid tile is the heaviest shape on a row and would
 * out-shout the one green button the reader is meant to press. The selected
 * agent wears identity green (green-soft with deep green); every other agent
 * gets a quiet tint derived from its address, so duplicate names stay apart.
 * The live dot sits on its corner, so presence reads off the same shape.
 */
export function AgentAvatar({
  name,
  address,
  online,
  size = 'md',
  selected = true,
  loading = false,
}: {
  /** The agent's own name. Without one the tile shows the onion: an initial
   *  taken from hex ("E" for 0x10e6…) means nothing. */
  name?: string
  address: string
  /** Info still on its way: an empty tile, so nothing is guessed and then swapped. */
  loading?: boolean
  online?: boolean
  size?: 'md' | 'lg'
  /** False for an agent listed beside others: it takes its address tint instead. */
  selected?: boolean
}) {
  const hue = addressHue(address)
  return (
    <span
      aria-hidden="true"
      style={selected || loading || !name ? undefined : {
        background: `color-mix(in oklab, hsl(${hue} 20% 50%) 10%, var(--color-white))`,
        color: `color-mix(in oklab, hsl(${hue} 20% 35%) 60%, var(--color-neutral-900))`,
      }}
      className={`relative flex shrink-0 items-center justify-center font-semibold ${loading || !name ? 'bg-co-raised' : selected ? 'bg-tint text-tint-fg' : ''} ${
        size === 'lg' ? 'h-12 w-12 rounded-xl text-lg' : 'h-8 w-8 rounded-lg text-[13px]'
      }`}
    >
      {loading ? null : name
        ? name.trim().charAt(0).toUpperCase()
        : <Image src="/onion-green.png" alt="" width={size === 'lg' ? 24 : 18} height={size === 'lg' ? 24 : 18} />}
      {online && (
        <span className="absolute -right-[3px] -bottom-[3px] h-2.5 w-2.5 rounded-full border-2 border-white bg-co-green-text" />
      )}
    </span>
  )
}
