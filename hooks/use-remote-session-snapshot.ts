'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  connect,
  type BrowserIdentity,
  type ChatItem,
  type SessionGetOptions,
  type SessionGetResult,
} from '@connectonion/react'

interface SnapshotClient {
  getSession(sessionId: string, options?: SessionGetOptions): Promise<SessionGetResult>
  reset(): void
}

type SnapshotClientFactory = (
  agentAddress: string,
  options: { signer: BrowserIdentity; sessionSyncOnly: true },
) => SnapshotClient

interface FetchRemoteSessionSnapshotOptions {
  agentAddress: string
  sessionId: string
  identity: BrowserIdentity
  ifRevision?: number
  createClient?: SnapshotClientFactory
}

interface RemoteSessionSnapshot {
  snapshotRevision: number
  /** Null means the caller's existing snapshot is already current. */
  ui: ChatItem[] | null
}

/** Read one retained transcript without attaching to its single-writer live session. */
export async function fetchRemoteSessionSnapshot({
  agentAddress,
  sessionId,
  identity,
  ifRevision,
  createClient = connect,
}: FetchRemoteSessionSnapshotOptions): Promise<RemoteSessionSnapshot> {
  const client = createClient(agentAddress, {
    signer: identity,
    sessionSyncOnly: true,
  })
  try {
    const result = ifRevision === undefined
      ? await client.getSession(sessionId)
      : await client.getSession(sessionId, { ifRevision })
    if (result.notModified) {
      return { snapshotRevision: result.revision, ui: null }
    }
    return {
      snapshotRevision: result.snapshotRevision,
      ui: result.records.map(record => record.data),
    }
  } finally {
    client.reset()
  }
}

interface UseRemoteSessionSnapshotOptions {
  agentAddress: string
  sessionId: string
  identity: BrowserIdentity | null
  remoteRevision?: number
  enabled: boolean
}

interface SnapshotState {
  key: string
  ui: ChatItem[]
  snapshotRevision?: number
  loading: boolean
  error: string | null
}

const EMPTY_STATE: SnapshotState = {
  key: '',
  ui: [],
  loading: false,
  error: null,
}

/** Keep a remote-only route on a revision-consistent Host snapshot. */
export function useRemoteSessionSnapshot({
  agentAddress,
  sessionId,
  identity,
  remoteRevision,
  enabled,
}: UseRemoteSessionSnapshotOptions) {
  const key = `${agentAddress}:${sessionId}`
  const [state, setState] = useState<SnapshotState>(EMPTY_STATE)
  const latestRevision = useRef<{ key: string; revision?: number }>({ key })
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!enabled || !identity) return
    let cancelled = false
    const previousRevision = latestRevision.current.key === key
      ? latestRevision.current.revision
      : undefined
    fetchRemoteSessionSnapshot({
      agentAddress,
      sessionId,
      identity,
      ifRevision: previousRevision,
    }).then(result => {
      if (cancelled) return
      latestRevision.current = { key, revision: result.snapshotRevision }
      setState(current => ({
        key,
        ui: result.ui ?? (current.key === key ? current.ui : []),
        snapshotRevision: result.snapshotRevision,
        loading: false,
        error: null,
      }))
    }).catch(error => {
      if (cancelled) return
      setState(current => ({
        key,
        ui: current.key === key ? current.ui : [],
        snapshotRevision: current.key === key ? current.snapshotRevision : undefined,
        loading: false,
        error: error instanceof Error ? error.message : 'Could not load synced transcript',
      }))
    })
    return () => { cancelled = true }
  }, [agentAddress, enabled, identity, key, reloadToken, remoteRevision, sessionId])

  const reload = useCallback(() => setReloadToken(value => value + 1), [])
  return state.key === key
    ? { ...state, reload }
    : { ...EMPTY_STATE, loading: enabled && Boolean(identity), reload }
}
