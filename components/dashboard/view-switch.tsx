/**
 * @purpose Say which of the agent's two panes is showing, and let a thumb change it,
 *   without spending a second bar to do it.
 * @llm-note This used to be a full-width band directly under the mobile header:
 *   same `bg-neutral-50`, same `border-b`, same width. Two identically-filled bars
 *   separated by one hairline read as a seam rather than as structure, and that
 *   seam — not the pixel count — is what made the top of the screen feel cramped.
 *   Measured: header 61px, band 45px, 12.6% of an 844px viewport.
 *
 *   So it moved into the header instead, right-aligned, and the band is gone.
 *   Intrinsically sized on purpose: a segmented control says "two views of one
 *   thing", and stretching it edge to edge is what made it read as navigation to
 *   two destinations — which is also why people expected the back button to undo it.
 *
 *   The track is `neutral-200/70`, not `neutral-50`. White-on-neutral-50 gave the
 *   selected segment a 1.02:1 surface contrast against the bar behind it, so the
 *   only real cue was the text colour and the unselected side read as *disabled*
 *   rather than as the other half of a pair.
 *
 *   `min-h-11` with negative margin buys a 44px touch box out of a 32px-tall
 *   control: Apple asks for 44, Material for 48, and every target in this header
 *   used to be 32–36.
 */
'use client'

import { HiOutlineViewGrid, HiOutlineChatAlt2 } from 'react-icons/hi'
import { cn } from '@/components/chat/utils'

export type MobileView = 'chat' | 'home'

const SEGMENTS = [
  { key: 'home' as const, label: 'Home', Icon: HiOutlineViewGrid },
  { key: 'chat' as const, label: 'Chat', Icon: HiOutlineChatAlt2 },
]

export function ViewSwitch({
  view, onChange,
}: {
  view: MobileView
  onChange: (v: MobileView) => void
}) {
  return (
    // role=tablist, because the panes are two views of one agent. Without this a
    // screen reader announced "Home, button. Chat, button." and never said which
    // one you were on.
    <div
      role="tablist"
      aria-label="Agent view"
      className="lg:hidden flex shrink-0 items-center gap-0.5 rounded-lg bg-neutral-200/70 p-0.5"
    >
      {SEGMENTS.map(({ key, label, Icon }) => (
        <button
          key={key}
          role="tab"
          aria-selected={view === key}
          onClick={() => onChange(key)}
          className={cn(
            'flex min-h-11 items-center gap-1 rounded-[7px] px-2.5 py-1.5 -my-1.5',
            'text-[13px] font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
            view === key
              ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-neutral-300/70'
              : 'text-neutral-600 active:bg-neutral-300/50',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  )
}
