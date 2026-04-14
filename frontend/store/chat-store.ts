import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UI } from '@/components/chat/types'

export interface Conversation {
  sessionId: string       // Primary key (UUID from SDK/server)
  title: string           // First 30 chars of first message
  agentAddress: string    // Agent's public key "0x..."
  ui: UI[]                // Full conversation UI
  createdAt: Date
}

export interface UserProfile {
  public_key: string
  credits_usd: number
  total_cost_usd: number
  balance_usd: number
}

interface ChatState {
  // Persisted
  conversations: Conversation[]
  activeSessionId: string | null
  agents: string[]  // Saved agent addresses (0x...)
  openonionApiKey: string  // JWT token for transcription & LLM calls
  // Auth state (persisted)
  userProfile: UserProfile | null
  // Transient state (not persisted)
  pendingMessage: string | null  // Message to send after navigation
}

interface ChatActions {
  createConversation: (sessionId: string, agentAddress: string) => void
  selectConversation: (sessionId: string) => void
  deleteConversation: (sessionId: string) => void
  updateTitle: (sessionId: string, title: string) => void
  updateUI: (sessionId: string, ui: UI[]) => void
  addAgent: (address: string) => void
  removeAgent: (address: string) => void
  setApiKey: (apiKey: string) => void
  setUserProfile: (profile: UserProfile | null) => void
  clearActive: () => void
  setPendingMessage: (message: string | null) => void
  consumePendingMessage: () => string | null
}

type ChatStore = ChatState & ChatActions

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      activeSessionId: null,
      agents: [],
      openonionApiKey: '',
      userProfile: null,
      pendingMessage: null,

      createConversation: (sessionId, agentAddress) => {
        const exists = get().conversations.some(c => c.sessionId === sessionId)
        if (exists) return

        const newConv: Conversation = {
          sessionId,
          title: 'New chat',
          agentAddress,
          ui: [],
          createdAt: new Date(),
        }
        set(state => ({
          conversations: [newConv, ...state.conversations],
          activeSessionId: sessionId,
        }))
      },

      selectConversation: (sessionId) => {
        set({ activeSessionId: sessionId })
      },

      deleteConversation: (sessionId) => {
        set(state => ({
          conversations: state.conversations.filter(c => c.sessionId !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }))
      },

      updateTitle: (sessionId, title) => {
        set(state => ({
          conversations: state.conversations.map(c =>
            c.sessionId === sessionId ? { ...c, title: title.slice(0, 30) } : c
          ),
        }))
      },

      updateUI: (sessionId, ui) => {
        set(state => ({
          conversations: state.conversations.map(c =>
            c.sessionId === sessionId ? { ...c, ui } : c
          ),
        }))
      },

      addAgent: (address) => {
        const normalized = address.trim()
        if (!normalized) return
        const exists = get().agents.includes(normalized)
        if (exists) return
        set(state => ({ agents: [...state.agents, normalized] }))
      },

      removeAgent: (address) => {
        set(state => ({ agents: state.agents.filter(a => a !== address) }))
      },

      setApiKey: (apiKey) => {
        set({ openonionApiKey: apiKey })
      },

      setUserProfile: (profile) => {
        set({ userProfile: profile })
      },

      clearActive: () => {
        set({ activeSessionId: null })
      },

      setPendingMessage: (message) => {
        set({ pendingMessage: message })
      },

      consumePendingMessage: () => {
        const message = get().pendingMessage
        set({ pendingMessage: null })
        return message
      },
    }),
    {
      name: 'oo-chat-storage',
      // Exclude transient state from persistence
      partialize: (state) => ({
        conversations: state.conversations,
        activeSessionId: state.activeSessionId,
        agents: state.agents,
        openonionApiKey: state.openonionApiKey,
        userProfile: state.userProfile,
        // pendingMessage is intentionally excluded
      }),
      // Handle Date serialization + migration
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          // Restore Date objects
          if (parsed.state?.conversations) {
            parsed.state.conversations = parsed.state.conversations.map((c: Conversation) => ({
              ...c,
              createdAt: new Date(c.createdAt),
            }))
          }
          // Migrate: old single defaultAgentAddress → agents[]
          if (parsed.state?.defaultAgentAddress && !parsed.state?.agents?.length) {
            parsed.state.agents = [parsed.state.defaultAgentAddress]
          }
          // Clean up old fields
          delete parsed.state?.defaultAgentUrl
          delete parsed.state?.defaultAgentAddress
          return parsed
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
    }
  )
)
