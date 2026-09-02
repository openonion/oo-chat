import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FileAttachment } from '@/components/chat/types'
import type { SessionSummary } from '@connectonion/react'

function persistedDate(value: Date | string | undefined, fallback?: Date | string): Date {
  const restored = new Date(value ?? fallback ?? Date.now())
  return Number.isNaN(restored.getTime()) ? new Date() : restored
}

// The transcript itself is NOT here: the Agent Host retains the canonical
// session and the SDK caches it per browser. This store only indexes
// conversations for the sidebar.
export interface Conversation {
  sessionId: string       // Primary key (UUID from SDK/server)
  title: string           // First 30 chars of first message
  agentAddress: string    // Agent's public key "0x..."
  createdAt: Date
  updatedAt: Date
  /** Present only after Host has committed this conversation. */
  remoteRevision?: number
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
  // Transient authentication state. The browser identity re-authenticates after
  // every reload, so persisting either value only exposes credentials at rest.
  openonionApiKey: string  // JWT token for transcription & LLM calls
  userProfile: UserProfile | null
  // Transient state (not persisted)
  pendingMessage: string | null  // Message to send after navigation
  // Anything attached with it. Sending from the landing page navigates first and
  // sends on arrival, so whatever the composer held has to travel too — it used
  // to be dropped here, silently, after the reader had already seen the
  // thumbnail sitting in the composer.
  pendingImages: string[] | null
  // And files. #106 carried images across this navigation and stopped there,
  // leaving the third argument of onSend(content, images, files) still on the
  // floor — the same drop, one parameter over.
  pendingFiles: FileAttachment[] | null
  _hasHydrated: boolean
  sessionSyncReady: Record<string, boolean>
}

interface ChatActions {
  setHasHydrated: () => void
  createConversation: (sessionId: string, agentAddress: string) => void
  selectConversation: (sessionId: string) => void
  deleteConversation: (sessionId: string) => void
  updateTitle: (sessionId: string, title: string) => void
  mergeRemoteConversations: (
    agentAddress: string,
    sessions: SessionSummary[],
    removedSessionIds: string[],
  ) => void
  setSessionSyncReady: (agentAddress: string, ready: boolean) => void
  addAgent: (address: string) => void
  removeAgent: (address: string) => void
  setApiKey: (apiKey: string) => void
  setUserProfile: (profile: UserProfile | null) => void
  clearActive: () => void
  setPendingMessage: (message: string | null, images?: string[], files?: FileAttachment[]) => void
  consumePendingMessage: () => { message: string | null; images: string[] | null; files: FileAttachment[] | null }
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
      pendingImages: null,
      pendingFiles: null,
      _hasHydrated: false,
      sessionSyncReady: {},

      setHasHydrated: () => set({ _hasHydrated: true }),

      createConversation: (sessionId, agentAddress) => {
        const exists = get().conversations.some(c => c.sessionId === sessionId)
        if (exists) return

        const newConv: Conversation = {
          sessionId,
          title: 'New chat',
          agentAddress,
          createdAt: new Date(),
          updatedAt: new Date(),
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
        // There is no frontend flow to restore a deleted session, so also drop
        // the SDK's per-session transcript (co:agent:{address}:session:{id}) from
        // localStorage — otherwise it lingers orphaned and eats the ~5MB quota.
        const conv = get().conversations.find(c => c.sessionId === sessionId)
        if (conv && typeof localStorage !== 'undefined') {
          localStorage.removeItem(`co:agent:${conv.agentAddress}:session:${sessionId}`)
        }
        set(state => ({
          conversations: state.conversations.filter(c => c.sessionId !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }))
      },

      updateTitle: (sessionId, title) => {
        const nextTitle = title.slice(0, 30)
        set(state => ({
          conversations: state.conversations.map(c =>
            c.sessionId === sessionId && c.title !== nextTitle
              ? { ...c, title: nextTitle, updatedAt: new Date() }
              : c
          ),
        }))
      },

      mergeRemoteConversations: (agentAddress, sessions, removedSessionIds) => {
        const removed = new Set(removedSessionIds)
        set(state => {
          const byId = new Map(
            state.conversations
              .filter(conversation => !(
                conversation.agentAddress === agentAddress
                && conversation.remoteRevision !== undefined
                && removed.has(conversation.sessionId)
              ))
              .map(conversation => [
                `${conversation.agentAddress}:${conversation.sessionId}`,
                conversation,
              ]),
          )
          for (const summary of sessions) {
            const key = `${agentAddress}:${summary.session_id}`
            const current = byId.get(key)
            if (
              current?.agentAddress === agentAddress
              && current.remoteRevision !== undefined
              && current.remoteRevision > summary.revision
            ) continue
            byId.set(key, {
              sessionId: summary.session_id,
              title: summary.title || current?.title || 'Untitled chat',
              agentAddress,
              createdAt: persistedDate(summary.created_at),
              updatedAt: persistedDate(summary.updated_at, summary.created_at),
              remoteRevision: summary.revision,
            })
          }
          const conversations = Array.from(byId.values()).sort(
            (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
          )
          return {
            conversations,
            activeSessionId: state.activeSessionId && removed.has(state.activeSessionId)
              ? null
              : state.activeSessionId,
          }
        })
        if (typeof localStorage !== 'undefined') {
          for (const sessionId of removed) {
            localStorage.removeItem(`co:agent:${agentAddress}:session:${sessionId}`)
          }
        }
      },

      setSessionSyncReady: (agentAddress, ready) => {
        set(state => ({
          sessionSyncReady: {
            ...state.sessionSyncReady,
            [agentAddress]: ready,
          },
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
        // Removing an agent drops every conversation of that agent too — sidebar
        // entries plus their SDK transcripts in localStorage — since no frontend
        // flow restores a deleted session and orphaned data eats the ~5MB quota.
        const removed = get().conversations.filter(c => c.agentAddress === address)
        if (typeof localStorage !== 'undefined') {
          for (const c of removed) {
            localStorage.removeItem(`co:agent:${c.agentAddress}:session:${c.sessionId}`)
          }
        }
        const removedIds = new Set(removed.map(c => c.sessionId))
        set(state => ({
          agents: state.agents.filter(a => a !== address),
          conversations: state.conversations.filter(c => c.agentAddress !== address),
          activeSessionId: state.activeSessionId && removedIds.has(state.activeSessionId)
            ? null
            : state.activeSessionId,
        }))
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

      setPendingMessage: (message, images, files) => {
        set({
          pendingMessage: message,
          pendingImages: images?.length ? images : null,
          pendingFiles: files?.length ? files : null,
        })
      },

      consumePendingMessage: () => {
        const message = get().pendingMessage
        const images = get().pendingImages
        const files = get().pendingFiles
        set({ pendingMessage: null, pendingImages: null, pendingFiles: null })
        return { message, images, files }
      },
    }),
    {
      name: 'oo-chat-storage',
      onRehydrateStorage: () => (state) => {
        // Storage can restore synchronously while create() is still running.
        // Use the restored state's action, not the uninitialized exported hook.
        state?.setHasHydrated()
      },
      // Exclude transient state from persistence. Nothing here carries
      // images — the transcript (and its sanitizing) lives in the SDK store.
      partialize: (state) => ({
        conversations: state.conversations,
        activeSessionId: state.activeSessionId,
        agents: state.agents,
        // pendingMessage is intentionally excluded
      }),
      // Handle Date serialization + migration
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          let parsed
          try {
            parsed = JSON.parse(str)
          } catch (error) {
            console.warn('[oo-chat] Dropping unreadable persisted chat state', error)
            localStorage.removeItem(name)
            return null
          }
          // Restore Date objects
          if (parsed.state?.conversations) {
            // Migrate: drop the legacy per-conversation ui copy — the transcript
            // lives in the SDK's per-session store.
            parsed.state.conversations = parsed.state.conversations.map(({ ui: _legacyUI, ...c }: Conversation & { ui?: unknown }) => ({
              ...c,
              createdAt: persistedDate(c.createdAt),
              updatedAt: persistedDate(c.updatedAt, c.createdAt),
            }))
          }
          // Migrate: old single defaultAgentAddress → agents[]
          if (parsed.state?.defaultAgentAddress && !parsed.state?.agents?.length) {
            parsed.state.agents = [parsed.state.defaultAgentAddress]
          }
          // Alpha builds once persisted the voice/auth JWT and account profile.
          // The secure React identity can mint a fresh short-lived token after
          // every reload, so scrub old copies from disk during hydration.
          const hadPersistedAuth = Boolean(
            parsed.state
            && ('openonionApiKey' in parsed.state || 'userProfile' in parsed.state)
          )
          if (parsed.state) {
            delete parsed.state.openonionApiKey
            delete parsed.state.userProfile
          }
          // Clean up old fields
          delete parsed.state?.defaultAgentUrl
          delete parsed.state?.defaultAgentAddress
          if (hadPersistedAuth) localStorage.setItem(name, JSON.stringify(parsed))
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
