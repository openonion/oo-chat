'use client'

import { useCallback, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { HiOutlineStatusOnline, HiOutlineStatusOffline } from 'react-icons/hi'
import { ChatInput } from '@/components/chat'
import { ChatLayout } from '@/components/chat-layout'
import { useChatStore } from '@/store/chat-store'
import { useIdentity } from '@/hooks/use-identity'
import { useAgentInfo, shortAddress } from '@/hooks/use-agent-info'

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

  // Add agent if not in list
  useEffect(() => {
    if (address && !agents.includes(address)) {
      addAgent(address)
    }
  }, [address, agents, addAgent])

  // Clear active session on mount
  useEffect(() => {
    clearActive()
  }, [clearActive])

  // Get agent info
  const infoMap = useAgentInfo([address])
  const agentInfo = infoMap[address]

  const handleSend = useCallback((content: string) => {
    const sessionId = crypto.randomUUID()
    createConversation(sessionId, address)
    setPendingMessage(content)
    router.push(`/${address}/${sessionId}`)
  }, [address, createConversation, setPendingMessage, router])

  const label = agentInfo?.name || shortAddress(address)
  const isOnline = agentInfo?.online
  const tools = agentInfo?.tools || []

  // Generate suggestions from tools
  const toolHints = useMemo(() => {
    if (tools.length === 0) return null
    const displayTools = tools.slice(0, 5)
    return displayTools.map(tool => ({
      name: tool,
      // Convert tool name to readable format: "bash_tool" -> "Bash tool"
      label: tool.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
    }))
  }, [tools])

  return (
    <ChatLayout>
      <div className="flex-1 flex flex-col">
        {/* Main Content - Centered */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
          {/* Agent Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-neutral-900 flex items-center justify-center mb-6 shadow-xl shadow-neutral-200">
            <span className="text-white font-bold text-3xl">
              {label.charAt(0).toUpperCase()}
            </span>
          </div>

          {/* Agent Info */}
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-neutral-900">{label}</h1>
            {isOnline !== undefined && (
              isOnline
                ? <HiOutlineStatusOnline className="w-5 h-5 text-green-500" />
                : <HiOutlineStatusOffline className="w-5 h-5 text-neutral-400" />
            )}
          </div>

          <p className="text-sm text-neutral-400 font-mono mb-6">{shortAddress(address)}</p>

          {/* Tools/Capabilities */}
          {toolHints && toolHints.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-neutral-400 text-center mb-3">Available tools</p>
              <div className="flex flex-wrap justify-center gap-2">
                {toolHints.map((tool, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full bg-neutral-100 text-xs text-neutral-600 font-medium"
                  >
                    {tool.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <p className="text-neutral-500 text-center max-w-md">
            {isOnline
              ? 'This agent is online and ready to help. Type a message below to start.'
              : 'This agent appears to be offline. You can still send a message.'}
          </p>
        </div>

        {/* Input at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white via-white to-transparent pt-12">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={handleSend}
              placeholder="Message this agent..."
            />
          </div>
        </div>
      </div>
    </ChatLayout>
  )
}
