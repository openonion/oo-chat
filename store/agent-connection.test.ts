import { afterEach, expect, it } from 'vitest'
import { useAgentConnection } from './agent-connection'

afterEach(() => useAgentConnection.getState().setConnection(null))
it('distinguishes first connection from a drop and resets for a new session', () => {
  const set = useAgentConnection.getState().setConnection
  const connection = { agentAddress: 'agent', sessionId: 'one' }
  set({ ...connection, state: 'disconnected' })
  expect(useAgentConnection.getState().connection).toHaveProperty('hasConnected', false)
  set({ ...connection, state: 'reconnecting' })
  expect(useAgentConnection.getState().connection).toHaveProperty('hasConnected', false)
  set({ ...connection, state: 'connected' })
  set({ ...connection, state: 'reconnecting' })
  expect(useAgentConnection.getState().connection).toHaveProperty('hasConnected', true)
  set({ ...connection, sessionId: 'two', state: 'disconnected' })
  expect(useAgentConnection.getState().connection).toHaveProperty('hasConnected', false)
})
