'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi'
import { HiChevronDown, HiChevronUp } from 'react-icons/hi2'
import { ChatInput, ModeStatusBar } from '@/components/chat'

const SLASH_COMMANDS = [
  { id: '/today',      prefix: '📅', label: 'Daily email briefing by priority' },
  { id: '/weekly_summary', prefix: '📬', label: 'Weekly email summary' },
  { id: '/events',     prefix: '🗓️', label: 'Extract events from emails [days] [max-emails]' },
  { id: '/inbox',      prefix: '📥', label: 'Show recent emails [n]' },
  { id: '/search',     prefix: '🔍', label: 'Search emails <query>' },
  { id: '/unanswered', prefix: '⏳', label: 'Find emails pending your reply' },
  { id: '/contacts',   prefix: '👥', label: 'View your contacts' },
  { id: '/sync',       prefix: '🔄', label: 'Sync contacts from Gmail' },
  { id: '/init',       prefix: '🗄️', label: 'Initialise CRM database' },
  { id: '/identity',      prefix: '🆔', label: 'Show your email identity' },
  { id: '/writing_style', prefix: '✍️', label: 'Analyse your writing style [n]' },
]
import type { ApprovalMode } from '@/components/chat/types'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress } from '@/hooks/use-agent-info'

const SUGGESTIONS = [
  'What can you do?',
  'Show system info',
  'List files in current directory',
]

const COLLAPSED_COUNT = 5

export default function AgentLandingPage() {
  const params = useParams()
  const router = useRouter()
  const address = params.address as string

  const {
    agents,
    addAgent,
    createConversation,
    setPendingMessage,
    clearActive,
  } = useChatStore()

  useIdentity()

  const [mode, setMode] = useState<ApprovalMode>('safe')
  const [pendingUlwTurns, setPendingUlwTurns] = useState<number | null>(null)
  const [skillsExpanded, setSkillsExpanded] = useState(false)

  const handleModeChange = useCallback((newMode: ApprovalMode, options?: { turns?: number }) => {
    setMode(newMode)
    if (newMode === 'ulw' && options?.turns) {
      setPendingUlwTurns(options.turns)
    } else {
      setPendingUlwTurns(null)
    }
  }, [])

  useEffect(() => {
    if (address && !agents.includes(address)) {
      addAgent(address)
    }
  }, [address, agents, addAgent])

  useEffect(() => {
    clearActive()
  }, [clearActive])

  const infoMap = useAgentInfo([address])
  const agentInfo = infoMap[address]

  const handleSend = useCallback((content: string, _images?: string[]) => {
    const sessionId = crypto.randomUUID()
    createConversation(sessionId, address)
    setPendingMessage(content)

    const params = new URLSearchParams()
    if (mode !== 'safe') {
      params.set('mode', mode)
      if (mode === 'ulw' && pendingUlwTurns) {
        params.set('turns', String(pendingUlwTurns))
      }
    }
    const query = params.toString()
    router.push(`/${address}/${sessionId}${query ? `?${query}` : ''}`)
  }, [address, createConversation, setPendingMessage, mode, pendingUlwTurns, router])

  const label = agentInfo?.name || shortAddress(address)
  const isOnline = agentInfo?.online
  const skills = agentInfo?.skills || []
  const tools = agentInfo?.tools || []

  const metaLine = useMemo(() => {
    const parts: string[] = []
    if (agentInfo?.model) parts.push(agentInfo.model)
    if (agentInfo?.trust) parts.push(agentInfo.trust)
    if (agentInfo?.version) parts.push(`v${agentInfo.version}`)
    return parts.join(' · ')
  }, [agentInfo?.model, agentInfo?.trust, agentInfo?.version])

  const visibleSkills = skillsExpanded ? skills : skills.slice(0, COLLAPSED_COUNT)
  const hiddenCount = skills.length - COLLAPSED_COUNT

  const toolsLine = useMemo(() => {
    if (tools.length === 0) return null
    const max = 6
    const names = tools.slice(0, max).map(t =>
      t.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
    )
    const rest = tools.length - max
    return names.join(' · ') + (rest > 0 ? ` +${rest} more` : '')
  }, [tools])

  const acceptsLine = useMemo(() => {
    const inputs = agentInfo?.acceptedInputs
    if (!inputs) return null
    const parts: string[] = []
    if (inputs.text) parts.push('text')
    if (inputs.images) parts.push('images')
    if (inputs.files) parts.push(`files (${inputs.files.max_file_size_mb}MB)`)
    return parts.length > 0 ? parts.join(' · ') : null
  }, [agentInfo?.acceptedInputs])

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col min-h-0">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-lg mx-auto px-5 pt-16 sm:pt-24 pb-8">

            {/* Hero */}
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-bold text-xl">
                  {label.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex items-center justify-center gap-1.5 mb-1">
                <h1 className="text-lg font-semibold text-neutral-900">{label}</h1>
                {isOnline !== undefined && (
                  isOnline
                    ? <HiOutlineStatusOnline className="w-4 h-4 text-green-500" />
                    : <HiOutlineStatusOffline className="w-4 h-4 text-neutral-400" />
                )}
              </div>

              {metaLine && (
                <p className="text-[11px] text-neutral-400">{metaLine}</p>
              )}
            </div>

          {/* Description */}
          <p className="text-neutral-500 text-center max-w-md">
            {isOnline
              ? 'This agent is online and ready to help. Type a message below to start.'
              : 'This agent appears to be offline. You can still send a message.'}
          </p>
            {/* Skills - slash command palette style */}
            {skills.length > 0 && (
              <div className="mb-6 rounded-xl border border-neutral-200 bg-white overflow-hidden">
                {visibleSkills.map((skill, i) => (
                  <button
                    key={i}
                    onClick={() => handleSend('/' + skill.name)}
                    className="flex w-full items-baseline gap-2 px-4 py-2.5 border-b border-neutral-100 last:border-b-0 text-left hover:bg-neutral-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-neutral-800 shrink-0">/{skill.name}</span>
                    <span className="text-xs text-neutral-400 truncate">{skill.description || 'No description'}</span>
                  </button>
                ))}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setSkillsExpanded(!skillsExpanded)}
                    className="flex items-center justify-center gap-1 w-full px-4 py-2 text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-50 transition-colors border-t border-neutral-100"
                  >
                    {skillsExpanded ? (
                      <>Show less <HiChevronUp className="w-3 h-3" /></>
                    ) : (
                      <>+{hiddenCount} more <HiChevronDown className="w-3 h-3" /></>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Tools + Accepts */}
            {(toolsLine || acceptsLine) && (
              <div className="text-center text-[11px] space-y-0.5">
                {toolsLine && <p className="text-neutral-400">{toolsLine}</p>}
                {acceptsLine && <p className="text-neutral-300">{acceptsLine}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: suggestions + input */}
        <div className="shrink-0 bg-white border-t border-neutral-100 px-4 pb-4 pt-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-neutral-200 px-3.5 py-1.5 text-xs text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 hover:bg-neutral-50 transition-all active:scale-[0.97]"
                >
                  {s}
                </button>
              ))}
            </div>
            <ChatInput
              onSend={handleSend}
              placeholder="Message this agent..."
              slashCommands={SLASH_COMMANDS}
              skills={skills}
              statusBar={
                <ModeStatusBar
                  mode={mode}
                  onModeChange={handleModeChange}
                  ulwTurnsRemaining={pendingUlwTurns}
                />
              }
            />
          </div>
        </div>
      </div>
    </ChatLayout>
  )
}
