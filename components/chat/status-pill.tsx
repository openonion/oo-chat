import { HiCheck, HiNoSymbol, HiXMark } from 'react-icons/hi2'
import { cn } from './utils'

/**
 * The run/task status word and its mark (design standard §4). The word always
 * shows; the mark and the soft fill only support it.
 */
export type RunStatus =
  | 'running' | 'needs-approval' | 'needs-input' | 'needs-sign-in'
  | 'done' | 'failed' | 'declined' | 'skipped' | 'stopped' | 'redirected'

type Tone = 'success' | 'warning' | 'danger' | 'neutral'

const PILLS: Record<RunStatus, { word: string; tone: Tone; mark: React.ReactNode }> = {
  running: { word: 'Running', tone: 'success', mark: <span className="h-1.5 w-1.5 rounded-full bg-current motion-safe:animate-pulse" /> },
  'needs-approval': { word: 'Needs approval', tone: 'warning', mark: '!' },
  'needs-input': { word: 'Needs input', tone: 'warning', mark: '!' },
  'needs-sign-in': { word: 'Needs sign-in', tone: 'warning', mark: '!' },
  done: { word: 'Done', tone: 'success', mark: <HiCheck className="h-3 w-3" /> },
  failed: { word: 'Failed', tone: 'danger', mark: <HiXMark className="h-3 w-3" /> },
  declined: { word: 'Declined', tone: 'neutral', mark: <HiNoSymbol className="h-3 w-3" /> },
  skipped: { word: 'Skipped', tone: 'neutral', mark: '»' },
  stopped: { word: 'Stopped', tone: 'neutral', mark: <span className="h-2 w-2 rounded-[1px] bg-current" /> },
  // A blocked tool the agent was steered away from: neutral », like Skipped.
  redirected: { word: 'Redirected', tone: 'neutral', mark: '»' },
}

const TONES: Record<Tone, string> = {
  success: 'bg-co-green-soft text-co-green-text',
  warning: 'bg-co-warning-soft text-co-warning',
  danger: 'bg-co-danger-soft text-co-danger',
  neutral: 'bg-co-neutral-soft text-co-neutral',
}

/** The status word alone, for text that cannot hold a pill. One vocabulary. */
export function statusWord(status: RunStatus): string {
  return PILLS[status].word
}

/** A finished tool row's meta: facts only (count, time). The ✓/✕ mark on the
 *  rail carries the outcome; a failure also leads with the word, in danger. */
export function ToolMeta({ failed = false, facts, className }: { failed?: boolean; facts: (string | null | undefined | false)[]; className?: string }) {
  const text = facts.filter(Boolean).join(' · ')
  return (
    <span className={cn('whitespace-nowrap text-xs tabular-nums text-neutral-600', className)}>
      {failed && <span className="font-semibold text-co-danger">Failed</span>}
      {failed && text ? ' · ' : ''}{text}
    </span>
  )
}

export function StatusPill({ status, className }: { status: RunStatus; className?: string }) {
  const { word, tone, mark } = PILLS[status]
  return (
    <span data-status={status} className={cn(
      'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs leading-4 font-semibold',
      TONES[tone], className,
    )}>
      <span aria-hidden="true" className="grid h-3 w-3 place-items-center font-bold">{mark}</span>
      {word}
    </span>
  )
}
