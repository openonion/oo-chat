import { afterEach, expect, test, vi } from 'vitest'
import { GET } from './route'

afterEach(() => vi.unstubAllGlobals())

test('online discovery exposes display fields without relay endpoints or raw skills', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ agents: [{
    address: `0x${'a'.repeat(64)}`,
    endpoints: ['ws://private-host'],
    profile: { alias: 'A public agent', model: 'model-x', skills: [
      { name: 'analyze-files', description: 'Analyze uploaded documents and explain key findings. Use this for reports.' },
      { name: 'debug_dump', description: 'Internal state' },
    ] },
  }, { address: 'malformed', profile: { alias: 'Ignore' } }] })))

  const response = await GET()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ agents: [{
    address: `0x${'a'.repeat(64)}`,
    name: 'A public agent',
    model: 'model-x',
    skillCount: 2,
    capabilities: [{ name: 'analyze-files', title: 'Analyze Files', summary: 'Analyze uploaded documents and explain key findings.' }],
  }] })
})

test('online discovery returns a recoverable error when the relay fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('unavailable', { status: 503 })))
  const response = await GET()
  expect(response.status).toBe(502)
  expect(await response.json()).toEqual({ error: 'Could not load online agents. Please try again.' })
})
