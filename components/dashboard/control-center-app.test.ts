import { describe, expect, it } from 'vitest'
import {
  capabilityPolicy,
  validateControlCenterApp,
  type ControlCenterAppDescriptor,
} from './control-center-app'

const REVISION = `sha256:${'a'.repeat(64)}`
const APPROVED: ControlCenterAppDescriptor = {
  schema: 'connectonion.control-app/1',
  revision: REVISION,
  url: 'https://apps.example.net/agent/revision/index.html',
  sdk_version: '1',
  review: { status: 'approved', review_id: 'review-1' },
  capabilities: ['clipboard-write', 'fullscreen'],
}

describe('validateControlCenterApp', () => {
  it('accepts an approved HTTPS app on a separate origin', () => {
    const result = validateControlCenterApp(APPROVED, 'https://chat.openonion.ai')
    expect(result.error).toBeNull()
    expect(result.app).toMatchObject({
      origin: 'https://apps.example.net',
      revision: REVISION,
    })
  })

  it.each([
    ['product cookie domain', { ...APPROVED, url: 'https://apps.openonion.ai/app' }],
    ['identity cookie domain', { ...APPROVED, url: 'https://apps.connectonion.com/app' }],
    ['mutable query', { ...APPROVED, url: 'https://apps.example.net/app?revision=latest' }],
    ['same-origin execution', { ...APPROVED, url: 'https://chat.openonion.ai/app' }],
    ['HTTP execution', { ...APPROVED, url: 'http://apps.example.net/app' }],
    ['credentials in the URL', { ...APPROVED, url: 'https://token@apps.example.net/app' }],
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

it('turns requested browser capabilities into an iframe allow policy', () => {
  expect(capabilityPolicy(['clipboard-write', 'fullscreen']))
    .toBe("clipboard-write 'src'; fullscreen 'src'")
})
