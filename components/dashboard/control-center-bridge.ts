/**
 * @purpose Read one message from the Control Center frame into an intent O Chat may
 *   act on, or null. Pure, so the whole trust boundary is unit-tested in one place.
 * @llm-note Everything the frame says is untrusted intent. Skills must be in the
 *   agent's published list (fail closed while it loads) and shaped like a directory
 *   name, because they are interpolated into a `/skill` line. Prompts are the
 *   reader's own words, so they keep their newlines but must be non-empty and at
 *   most 10,000 characters after trimming. The task label is display text only.
 */

/** Skill names come from directory names: no spaces, no newlines, no separators. */
const SKILL_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
export const MAX_PROMPT = 10_000

export type BridgeIntent =
  | { kind: 'skill'; skill: string; args?: string; task: string }
  | { kind: 'prompt'; prompt: string; task: string }
  | { kind: 'open-chat' }
  | { kind: 'copy'; value: string }

function label(value: unknown, fallback: string): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200)
  return text || fallback
}

/** `channel` is the token of the document O Chat rendered (see bridgeScript);
 *  every message must carry it, open-chat included. */
export function readBridgeMessage(data: unknown, skills: { name: string }[] | undefined, channel: string): BridgeIntent | null {
  const message = (data ?? {}) as Record<string, unknown>
  if (!channel || message.channel !== channel) return null
  switch (message.type) {
    case 'ochat:skill': {
      const skill = String(message.skill || '')
      if (!SKILL_NAME.test(skill) || !skills?.some((s) => s.name === skill)) return null
      // Collapse whitespace so args can't break out of the single /skill line.
      const args = String(message.args || '').replace(/\s+/g, ' ').trim().slice(0, 500)
      return { kind: 'skill', skill, ...(args && { args }), task: label(message.task, skill) }
    }
    case 'ochat:prompt': {
      const prompt = String(message.prompt ?? '').trim()
      if (!prompt || prompt.length > MAX_PROMPT) return null
      return { kind: 'prompt', prompt, task: label(message.task, prompt) }
    }
    case 'ochat:open-chat':
      return { kind: 'open-chat' }
    case 'ochat:copy': {
      const value = String(message.value ?? '')
      return value && value.length <= 2000 ? { kind: 'copy', value } : null
    }
    default:
      return null
  }
}
