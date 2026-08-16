import { describe, expect, it } from 'vitest'
import { orderAgents } from './agent-order'

const info = (name: string, online: boolean) => ({ address: name, name, online })

describe('orderAgents', () => {
  it('pins selected, then orders online, unknown, and offline', () => {
    const result = orderAgents(
      ['offline', 'unknown', 'online', 'selected'],
      {
        offline: info('Offline', false),
        unknown: undefined,
        online: info('Online', true),
        selected: info('Selected', false),
      },
      'selected',
    )
    expect(result.map(item => [item.address, item.presence])).toEqual([
      ['selected', 'offline'],
      ['online', 'online'],
      ['unknown', 'unknown'],
      ['offline', 'offline'],
    ])
  })

  it('uses activity, name, then address as deterministic tie-breakers', () => {
    const result = orderAgents(
      ['z', 'b', 'a'],
      { z: info('Zulu', true), b: info('Alpha', true), a: info('Alpha', true) },
      null,
      { z: 20, b: 10, a: 10 },
    )
    expect(result.map(item => item.address)).toEqual(['z', 'a', 'b'])
  })
})
