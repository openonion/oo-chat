'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connect,
  initializeBrowserIdentity,
  SessionSyncError,
  type BrowserIdentity,
  type RemoteAgent,
  type SessionSummary,
} from '@connectonion/react'
import { useChatStore, type Conversation } from '@/store/chat-store'

const SYNC_INTERVAL_MS = 15_000
const CURSOR_PREFIX = 'oo-chat:session-sync:v1'

function cursorKey(identityAddress: string, agentAddress: string) {
  return `${CURSOR_PREFIX}:${encodeURIComponent(identityAddress)}:${encodeURIComponent(agentAddress)}`
}

function conflictSummary(error: unknown): SessionSummary | null {
  if (!(error instanceof SessionSyncError) || error.code !== 'revision_conflict') return null
  const data = error.data as { summary?: unknown } | undefined
  const summary = data?.summary as SessionSummary | undefined
  return summary && typeof summary.session_id === 'string'
    && Number.isSafeInteger(summary.revision)
    ? summary
    : null
}

/** Keep the local sidebar cache aligned with Host-retained chat history. */
export function useRecentChatSync(agentAddresses: string[]) {
  const mergeRemoteConversations = useChatStore(state => state.mergeRemoteConversations)
  const setSessionSyncReady = useChatStore(state => state.setSessionSyncReady)
  const [identity, setIdentity] = useState<BrowserIdentity | null>(null)
  const clients = useRef(new Map<string, RemoteAgent>())
  const inFlight = useRef(new Map<string, Promise<void>>())
  const unsupported = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    initializeBrowserIdentity().then(initialized => {
      if (active) setIdentity(initialized.identity)
    }).catch(error => {
      console.warn('[oo-chat] Recent Chat identity unavailable', error)
      for (const address of useChatStore.getState().agents) {
        setSessionSyncReady(address, true)
      }
    })
    return () => { active = false }
  }, [setSessionSyncReady])

  const clientFor = useCallback((agentAddress: string) => {
    if (!identity) throw new Error('Browser identity is not ready')
    let client = clients.current.get(agentAddress)
    if (!client) {
      client = connect(agentAddress, {
        signer: identity,
        sessionSyncOnly: true,
      })
      clients.current.set(agentAddress, client)
    }
    return client
  }, [identity])

  const syncAgent = useCallback((agentAddress: string): Promise<void> => {
    if (!identity || unsupported.current.has(agentAddress)) return Promise.resolve()
    const current = inFlight.current.get(agentAddress)
    if (current) return current

    const task = (async () => {
      const client = clientFor(agentAddress)
      const key = cursorKey(identity.address, agentAddress)
      const hasRemoteCache = useChatStore.getState().conversations.some(
        conversation => conversation.agentAddress === agentAddress
          && conversation.remoteRevision !== undefined,
      )
      let cursor = hasRemoteCache ? localStorage.getItem(key) ?? undefined : undefined
      if (!hasRemoteCache) localStorage.removeItem(key)

      try {
        let result
        try {
          result = await client.syncSessions({ cursor })
        } catch (error) {
          if (error instanceof SessionSyncError && error.code === 'cursor_expired') {
            localStorage.removeItem(key)
            cursor = undefined
            result = await client.syncSessions()
          } else {
            throw error
          }
        }
        mergeRemoteConversations(
          agentAddress,
          result.sessions,
          result.removedSessionIds,
        )
        localStorage.setItem(key, result.cursor)
      } catch (error) {
        if (error instanceof SessionSyncError && error.code === 'unsupported_extension') {
          unsupported.current.add(agentAddress)
          client.reset()
          clients.current.delete(agentAddress)
          return
        }
        console.warn(`[oo-chat] Recent Chat sync failed for ${agentAddress}`, error)
      }
    })().finally(() => {
      setSessionSyncReady(agentAddress, true)
      if (inFlight.current.get(agentAddress) === task) inFlight.current.delete(agentAddress)
    })
    inFlight.current.set(agentAddress, task)
    return task
  }, [clientFor, identity, mergeRemoteConversations, setSessionSyncReady])

  useEffect(() => {
    if (!identity) return
    const activeAgents = new Set(agentAddresses)
    for (const [address, client] of clients.current) {
      if (!activeAgents.has(address)) {
        client.reset()
        clients.current.delete(address)
        unsupported.current.delete(address)
      }
    }
    const syncAll = () => {
      for (const address of agentAddresses) {
        if (useChatStore.getState().sessionSyncReady[address] === undefined) {
          setSessionSyncReady(address, false)
        }
        void syncAgent(address)
      }
    }
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncAll()
    }
    syncAll()
    const interval = window.setInterval(syncAll, SYNC_INTERVAL_MS)
    window.addEventListener('focus', syncAll)
    window.addEventListener('online', syncAll)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', syncAll)
      window.removeEventListener('online', syncAll)
      document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [agentAddresses, identity, setSessionSyncReady, syncAgent])

  useEffect(() => () => {
    for (const client of clients.current.values()) client.reset()
    clients.current.clear()
  }, [])

  const archiveConversation = useCallback(async (conversation: Conversation) => {
    if (conversation.remoteRevision === undefined) return
    const client = clientFor(conversation.agentAddress)
    try {
      await client.updateSession(
        conversation.sessionId,
        { archived: true },
        conversation.remoteRevision,
      )
    } catch (error) {
      const current = conflictSummary(error)
      if (!current) throw error
      mergeRemoteConversations(conversation.agentAddress, [current], [])
      await client.updateSession(
        conversation.sessionId,
        { archived: true },
        current.revision,
      )
    }
    mergeRemoteConversations(
      conversation.agentAddress,
      [],
      [conversation.sessionId],
    )
  }, [clientFor, mergeRemoteConversations])

  return { archiveConversation, syncAgent }
}
