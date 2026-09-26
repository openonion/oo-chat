export type PublicCapability = {
  name: string
  title: string
  summary: string
}

const INTERNAL = /debug|capture|not for direct|called by other skills|internal/i
const SETUP_SKILL = /(?:^|[-_])(?:login|auth|setup)(?:$|[-_])/i

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
    const summary = sentence.length > 150
      ? `${sentence.slice(0, 147).replace(/\s+\S*$/, '')}…`
      : sentence
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
