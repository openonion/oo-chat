import { shortAddress, type AgentInfo } from '@/hooks/use-agent-info'
import { cn } from '@/components/chat/utils'

/**
 * An agent's label. While its info is loading this is a quiet placeholder, never
 * the address: an address shown for a second and then replaced reads as a
 * different agent. Only info that came back without a name (or failed, see
 * useAgentInfo) shows the address, in mono because it is data.
 */
export function AgentName({ info, address, className }: { info?: AgentInfo; address: string; className?: string }) {
  if (info === undefined) {
    return <span role="status" aria-label="Loading agent name" className="inline-block h-[0.9em] w-16 rounded bg-co-raised align-middle" />
  }
  if (info.name) return <span className={className}>{info.name}</span>
  return <span className={cn(className, 'font-mono')}>{shortAddress(address)}</span>
}
