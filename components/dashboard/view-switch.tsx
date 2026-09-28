/** Mobile panes share one quiet text-tab row with visible selection and pending decisions. */
'use client'

import { cn } from '@/components/chat/utils'

export type MobileView = 'chat' | 'home'

const SEGMENTS = [
  { key: 'home' as const, label: 'Control', accessibleLabel: 'Control Center' },
  { key: 'chat' as const, label: 'Chat', accessibleLabel: 'Chat' },
]

export function ViewSwitch({
  view, onChange, attention,
}: {
  view: MobileView
  onChange: (v: MobileView) => void
  /** The pane holding something the reader has to answer. On a phone the panes
   *  are exclusive, so without this a run that parks for an approval is invisible
   *  from the other side and simply never proceeds. */
  attention?: MobileView | null
}) {
  return (
    // role=tablist, because the panes are two views of one agent. Without this a
    // screen reader announced "Home, button. Chat, button." and never said which
    // one you were on.
    <div
      role="tablist"
      aria-label="Agent view"
      className="lg:hidden flex shrink-0 items-center gap-1"
    >
      {SEGMENTS.map(({ key, label, accessibleLabel }) => {
        // Only on the side you are not looking at: a dot on the pane already in
        // front of you points at something you can see, which is noise.
        const waiting = attention === key && view !== key
        return (
        <button
          key={key}
          role="tab"
          aria-label={waiting ? `${accessibleLabel}, waiting for you` : accessibleLabel}
          aria-selected={view === key}
          onClick={() => onChange(key)}
          className={cn(
            'flex min-h-11 items-center gap-1 border-b-2 px-2 py-1.5',
            'text-[13px] font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-identity-700',
            view === key
              ? 'border-neutral-800 text-neutral-950'
              : 'border-transparent text-neutral-500 hover:text-neutral-900',
          )}
        >
          {label}
          {waiting && (
            <>
              {/* neutral-400 and pulsing, which is exactly what ToolStatus draws
                  on a tool row parked on the reader. The app already spends
                  brand-500 on two other things in this same header row — the
                  online dot beside the agent's name, and a running tool — so a
                  third green dot here would have said "the agent is working"
                  while meaning the opposite. The pulse is what carries the eye.

                  The dot carries nothing for a screen reader, so the accessible
                  name has to say it too — otherwise the one reader who cannot see
                  the marker is the one left waiting on a run waiting on them. */}
              <span
                data-attention
                aria-hidden
                className="ml-0.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-neutral-400"
              />
            </>
          )}
        </button>
        )
      })}
    </div>
  )
}
