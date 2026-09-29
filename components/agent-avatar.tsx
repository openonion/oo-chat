import { agentInitial } from '@/hooks/use-agent-info'

/**
 * An agent's tile: a soft green square with a green initial.
 *
 * Soft on purpose. A solid tile is the heaviest shape on a row, and on the agent
 * page and in the sidebar it out-shouted the one green button the reader was
 * meant to press. The live dot sits on its corner, so presence is read off the
 * same shape everywhere.
 */
export function AgentAvatar({
  label,
  address,
  online,
  size = 'md',
}: {
  label: string
  address: string
  online?: boolean
  size?: 'md' | 'lg'
}) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center bg-tint font-semibold text-tint-fg ${
        size === 'lg' ? 'h-12 w-12 rounded-xl text-lg' : 'h-8 w-8 rounded-lg text-[13px]'
      }`}
    >
      {agentInitial(label, address)}
      {online && (
        <span className="absolute -right-[3px] -bottom-[3px] h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
      )}
    </span>
  )
}
