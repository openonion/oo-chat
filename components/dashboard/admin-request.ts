/**
 * @purpose Turn a Control Center admin button click (posted by the sandboxed frame)
 *   into the Host command it asks for, plus the question a person must confirm.
 * @llm-note The Host renders these buttons only into an admin's page and decides
 *   every command again from the signer's address against admins.txt
 *   (connectonion#3263), so nothing here grants anything. The frame is still
 *   untrusted: a custom dashboard.html can post the same message under a button
 *   labelled anything. So the parent shape-checks the ask, and asks the person in
 *   its own words — the frame never writes the question.
 */

const ADDRESS = /^0x[0-9a-fA-F]{64}$/

const ACTIONS = {
  remove: { command: 'admin.remove', target: true,
    question: (who: string) => `Remove ${who} from this agent? They can come back only with a current invite code.` },
  block: { command: 'admin.block', target: true,
    question: (who: string) => `Block ${who}? This agent will refuse them from now on.` },
  rotate_invite: { command: 'admin.rotate_invite', target: false,
    question: () => 'Make a new invite code? The current one stops working now; people already admitted stay.' },
  invite_off: { command: 'admin.invite_off', target: false,
    question: () => 'Turn the invite code off? Nobody new can join with a code; people already admitted stay.' },
} as const

export interface AdminRequest {
  command: (typeof ACTIONS)[keyof typeof ACTIONS]['command']
  payload: { client_id?: string }
  question: string
}

export function adminRequest(data: unknown): AdminRequest | null {
  const message = data as { type?: unknown, action?: unknown, target?: unknown } | null
  if (message?.type !== 'ochat:admin') return null
  const action = ACTIONS[String(message.action) as keyof typeof ACTIONS]
  if (!action || !Object.hasOwn(ACTIONS, String(message.action))) return null
  const target = String(message.target || '')
  if (action.target !== ADDRESS.test(target)) return null
  if (!action.target && target) return null
  return {
    command: action.command,
    payload: action.target ? { client_id: target } : {},
    question: action.question(target),
  }
}
