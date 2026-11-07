import { create } from 'zustand'
import type { ConnectionState } from '@connectonion/react'

/** Only the open agent's transport is live; other agents use directory presence. */
export const useAgentConnection = create<{
  connection: { agentAddress: string; sessionId: string; state: ConnectionState; hasConnected: boolean } | null
  setConnection: (connection: { agentAddress: string; sessionId: string; state: ConnectionState } | null) => void
}>(set => ({
  connection: null,
  setConnection: connection => set(({ connection: previous }) => ({
    connection: connection && {
      ...connection,
      hasConnected: connection.state === 'connected' || Boolean(
        previous?.agentAddress === connection.agentAddress
        && previous.sessionId === connection.sessionId
        && previous.hasConnected,
      ),
    },
  })),
}))
