export type PublicCapability = {
  name: string
  title: string
  summary: string
}

const INTERNAL = /debug|capture|not for direct|called by other skills|internal/i
const SETUP_SKILL = /(?:^|[-_])(?:login|auth|setup)(?:$|[-_])/i

// Skill descriptions are written for the model that routes to them, not for a
// visitor: "Use when the user wants to start…" on a public profile tells the reader
// how the agent decides, not what it does. Keep the verb phrase, speak to the reader.
const ROUTING_LEAD = /^use (?:this(?: skill)? )?(?:when|if) (?:the )?user (?:wants|asks|needs) to\s+/i
// "(user)" / "(project)" is where the skill was installed from — a Claude Code
// convention that leaks through the description and means nothing to the reader.
const SOURCE_TAG = /\s*\((?:user|project|plugin|local)\)\s*$/i

function forReader(description: string) {
  let text = description.replace(SOURCE_TAG, '').replace(/`([^`]+)`/g, '$1')
  if (ROUTING_LEAD.test(text)) {
    text = text.replace(ROUTING_LEAD, '').replace(/\btheir\b/g, 'your').replace(/\bthe user\b/g, 'you')
    text = text.charAt(0).toUpperCase() + text.slice(1)
  }
  return text
}

/** Present only described, user-facing skills from an owner-published profile. */
export function publicCapabilities(skills: unknown, limit = 3): PublicCapability[] {
  if (!Array.isArray(skills)) return []
  const seen = new Set<string>()
  const result: PublicCapability[] = []

  for (const item of skills) {
    if (!item || typeof item !== 'object') continue
    const { name, description } = item as { name?: unknown; description?: unknown }
    if (typeof name !== 'string' || typeof description !== 'string') continue
    const cleanName = name.trim()
    const cleanDescription = description.replace(/\s+/g, ' ').trim()
    if (!/^[\w-]{2,80}$/.test(cleanName) || !cleanDescription ||
      INTERNAL.test(cleanName) || INTERNAL.test(cleanDescription) ||
      SETUP_SKILL.test(cleanName) || seen.has(cleanName)) continue

    const sentence = cleanDescription.match(/^.+?[.!?。！？](?=\s|$|[\u4e00-\u9fff])/)?.[0] || cleanDescription
    const readable = forReader(sentence)
    const summary = readable.length > 150
      ? `${readable.slice(0, 147).replace(/\s+\S*$/, '')}…`
      : readable
    result.push({
      name: cleanName,
      title: cleanName.replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase()).replace(/\bAi\b/g, 'AI'),
      summary,
    })
    seen.add(cleanName)
    if (result.length >= limit) break
  }

  return result
}
