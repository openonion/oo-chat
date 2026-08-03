import { HiOutlineCheck, HiOutlineX } from 'react-icons/hi'
import { cn } from '../../utils'

/**
 * The one status mark a tool row is allowed to draw.
 *
 * There were five: a literal `✓` text character in grep-card, `HiOutlineCheck`
 * inside a green circle in bash-card, the same icon inside a neutral circle in
 * CompactHeader, the strings `'✓' / '✗' / '●'` in plan-card, guide-card and
 * enter-plan-mode-card, and an `HiOutlineX`-or-nothing pair in generic-card.
 * Text glyphs render at the font's own weight and baseline, which is why grep's
 * check sat visibly heavier and lower than its neighbours in the same column.
 *
 * Fixed 16px box so the rail stays aligned whichever state is showing.
 */
export function ToolStatus({
  status,
  awaitingApproval = false,
  className,
}: {
  status: 'running' | 'done' | 'error' | string
  /** Neutral rather than brand while the run is parked on the reader. */
  awaitingApproval?: boolean
  className?: string
}) {
  return (
    <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center', className)}>
      {status === 'done' ? (
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-neutral-100">
          <HiOutlineCheck className="h-2.5 w-2.5 text-neutral-600" />
        </span>
      ) : status === 'error' ? (
        <HiOutlineX className="h-3.5 w-3.5 text-red-600" />
      ) : status === 'running' ? (
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full animate-pulse',
            awaitingApproval ? 'bg-neutral-400' : 'bg-brand-500'
          )}
        />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-neutral-300" />
      )}
    </span>
  )
}
