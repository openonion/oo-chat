import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UI } from '@/components/chat/types'

export interface Conversation {
  sessionId: string       // Primary key (UUID from SDK/server)
  title: string           // First 30 chars of first message
  agentAddress: string    // Agent's public key "0x..."
  agentUrl: string        // Connection URL
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
  defaultAgentUrl: string
  defaultAgentAddress: string
  openonionApiKey: string  // JWT token for transcription & LLM calls
  // Auth state (persisted)
  userProfile: UserProfile | null
  // Transient state (not persisted)
  pendingMessage: string | null  // Message to send after navigation
}

interface ChatActions {
  createConversation: (sessionId: string, agentAddress: string, agentUrl: string) => void
  selectConversation: (sessionId: string) => void
  deleteConversation: (sessionId: string) => void
  updateTitle: (sessionId: string, title: string) => void
  updateUI: (sessionId: string, ui: UI[]) => void
  setDefaults: (agentUrl: string, agentAddress?: string) => void
  setApiKey: (apiKey: string) => void
  setUserProfile: (profile: UserProfile | null) => void
  clearActive: () => void
  setPendingMessage: (message: string | null) => void
  consumePendingMessage: () => string | null
}

type ChatStore = ChatState & ChatActions

const DEFAULT_AGENT_URL = process.env.NEXT_PUBLIC_DEFAULT_AGENT_URL || 'http://localhost:8000'

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      // Initial state
      conversations: [],
      activeSessionId: null,
      defaultAgentUrl: DEFAULT_AGENT_URL,
      defaultAgentAddress: '',
      openonionApiKey: '',
      userProfile: null,
      pendingMessage: null,

      createConversation: (sessionId, agentAddress, agentUrl) => {
        const exists = get().conversations.some(c => c.sessionId === sessionId)
        if (exists) return

        const newConv: Conversation = {
          sessionId,
          title: 'New chat',
          agentAddress,
          agentUrl,
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

      setDefaults: (agentUrl, agentAddress) => {
        set({
          defaultAgentUrl: agentUrl,
          defaultAgentAddress: agentAddress || '',
        })
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
        defaultAgentUrl: state.defaultAgentUrl,
        defaultAgentAddress: state.defaultAgentAddress,
        openonionApiKey: state.openonionApiKey,
        userProfile: state.userProfile,
        // pendingMessage is intentionally excluded
      }),
      // Handle Date serialization
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
