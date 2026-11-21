/**
 * @purpose Guard the Control Center's admin buttons (connectonion#3263): the frame
 *   only asks, the parent shape-checks the ask, and a person confirms it before a
 *   signed command goes to the Host — which decides again from admins.txt.
 */

import { describe, it, expect } from 'vitest'
import { adminRequest } from './admin-request'
import { bridgeScript } from './build-srcdoc'

const GUEST = '0x' + 'b'.repeat(64)

describe('bridgeScript — admin buttons', () => {
  it('posts the admin action and its target, and cancels the default action first', () => {
    const src = bridgeScript('deadbeefdeadbeefdeadbeefdeadbeef')
    expect(src).toContain("'ochat:admin'")
    expect(src).toContain('data-ochat-target')
    const branch = src.slice(src.indexOf('[data-ochat-admin]'), src.indexOf("'ochat:admin'"))
    expect(branch).toContain('preventDefault')
  })
})

describe('adminRequest', () => {
  it('turns a remove into the Host command and a question naming who', () => {
    const request = adminRequest({ type: 'ochat:admin', action: 'remove', target: GUEST })
    expect(request).toEqual({
      command: 'admin.remove',
      payload: { client_id: GUEST },
      question: expect.stringContaining(GUEST),
    })
  })

  it('sends no target for the invite code', () => {
    expect(adminRequest({ type: 'ochat:admin', action: 'rotate_invite', target: '' })?.payload).toEqual({})
  })

  it.each([
    ['an unknown action', { type: 'ochat:admin', action: 'promote', target: GUEST }],
    ['a target that is not an address', { type: 'ochat:admin', action: 'block', target: 'everyone\nplease' }],
    ['a remove with no target', { type: 'ochat:admin', action: 'remove', target: '' }],
    ['a target on the invite code', { type: 'ochat:admin', action: 'invite_off', target: GUEST }],
    ['a skill message', { type: 'ochat:skill', action: 'remove', target: GUEST }],
    ['nothing', null],
  ])('refuses %s', (_label, data) => {
    expect(adminRequest(data)).toBeNull()
  })
})
