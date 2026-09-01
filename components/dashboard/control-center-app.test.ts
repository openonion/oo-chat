import { describe, expect, it } from 'vitest'
import {
  capabilityPolicy,
  conversationTarget,
  parseControlCenterRequest,
  validateControlCenterApp,
  type ControlCenterAppDescriptor,
} from './control-center-app'

const REVISION = `sha256:${'a'.repeat(64)}`
const APPROVED: ControlCenterAppDescriptor = {
  schema: 'connectonion.control-app/1',
  revision: REVISION,
  url: 'https://apps.openonion.ai/agent/revision/index.html',
  sdk_version: '1',
  review: { status: 'approved', review_id: 'review-1' },
  capabilities: ['clipboard-write', 'fullscreen'],
}

describe('validateControlCenterApp', () => {
  it('accepts an approved HTTPS app on a separate origin', () => {
    const result = validateControlCenterApp(APPROVED, 'https://chat.openonion.ai')
    expect(result.error).toBeNull()
    expect(result.app).toMatchObject({
      origin: 'https://apps.openonion.ai',
      revision: REVISION,
    })
  })

  it.each([
    ['same-origin execution', { ...APPROVED, url: 'https://chat.openonion.ai/app' }],
    ['HTTP execution', { ...APPROVED, url: 'http://apps.openonion.ai/app' }],
    ['credentials in the URL', { ...APPROVED, url: 'https://token@apps.openonion.ai/app' }],
    ['an invalid revision', { ...APPROVED, revision: 'latest' }],
    ['an unknown permission', { ...APPROVED, capabilities: ['payments'] }],
  ])('rejects %s', (_label, candidate) => {
    expect(validateControlCenterApp(candidate, 'https://chat.openonion.ai').app).toBeNull()
  })

  it('keeps review state visible instead of treating unapproved as malformed', () => {
    const result = validateControlCenterApp(
      { ...APPROVED, review: { status: 'reviewing' } },
      'https://chat.openonion.ai',
    )
    expect(result.app?.review.status).toBe('reviewing')
  })
})

describe('Control Center bridge request parsing', () => {
  const request = {
    type: 'connectonion.control-center/request',
    version: 1,
    revision: REVISION,
    id: 'invoice-button:1',
    action: 'run_skill',
    payload: { skill: 'generate-invoice' },
  }

  it('accepts a versioned request for the active revision', () => {
    expect(parseControlCenterRequest(request, REVISION).request).toEqual(request)
  })

  it('fails a stale revision closed', () => {
    const parsed = parseControlCenterRequest(request, `sha256:${'b'.repeat(64)}`)
    expect(parsed.request).toBeNull()
    expect(parsed.error).toMatch(/stale/i)
  })

  it('ignores unrelated page messages', () => {
    expect(parseControlCenterRequest({ type: 'analytics' }, REVISION)).toEqual({
      request: null,
      error: null,
      id: null,
    })
  })

  it('defaults buttons to the current conversation and permits explicit new chat', () => {
    expect(conversationTarget(undefined)).toBe('current')
    expect(conversationTarget('current')).toBe('current')
    expect(conversationTarget('new')).toBe('new')
    expect(conversationTarget('background')).toBeNull()
  })
})

it('turns requested browser capabilities into an iframe allow policy', () => {
  expect(capabilityPolicy(['clipboard-write', 'fullscreen']))
    .toBe("clipboard-write 'src'; fullscreen 'src'")
})
