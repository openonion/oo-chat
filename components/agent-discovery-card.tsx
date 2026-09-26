import Link from 'next/link'
import { HiOutlineArrowRight } from 'react-icons/hi'
import { agentInitial, shortAddress } from '@/hooks/use-agent-info'
import type { ListedAgent } from '@/hooks/use-online-agents'

export function AgentDiscoveryCard({ agent }: { agent: ListedAgent }) {
  const label = agent.name || shortAddress(agent.address)
  const task = agent.capabilities[0]

  return (
    <Link
      href={`/${agent.address}`}
      className="group flex h-full min-w-0 flex-col justify-between gap-5 rounded-xl border border-neutral-200 bg-white p-5 transition-colors hover:border-identity-700/40 hover:bg-identity-50/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-identity-700"
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-identity-50 text-sm font-semibold text-identity-800 ring-1 ring-identity-100">
          {agentInitial(label, agent.address)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-semibold text-neutral-900">{label}</span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Online
            </span>
          </div>
          {task ? (
            <>
              <h3 className="mt-3 text-base font-semibold leading-6 text-neutral-900">{task.title}</h3>
              <p className="mt-1 text-sm leading-6 text-neutral-700">{task.summary}</p>
            </>
          ) : (
            <p className="mt-3 text-sm leading-6 text-neutral-600">
              No public task examples yet. Open this agent to learn more.
            </p>
          )}
        </div>
      </div>
      <span className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs">
        <span className="text-neutral-600">Access is checked when you open it</span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-identity-700">
          View agent <HiOutlineArrowRight aria-hidden="true" className="h-4 w-4" />
        </span>
      </span>
    </Link>
  )
}
